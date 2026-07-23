import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Pencil, Plus, PackagePlus, Trash2, X, Ban, RotateCcw, ChevronLeft, ChevronRight, Upload, Download } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';

const CSV_TEMPLATE =
  'name,brand,category,price,stock,manufacturer,description,expiryDate,requiresPrescription,barcode\n' +
  'Paracetamol 500mg,Calpol,Pain Relief,25.50,100,GSK,Fever and pain relief,2027-06-30,false,8901234567890\n';

const AdminMedicines = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const lowStock = searchParams.get('lowStock') === 'true';
  const expiringSoon = searchParams.get('expiringSoon') === 'true';

  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [lowStockThreshold, setLowStockThreshold] = useState(10); // overwritten by the API response below
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();

  const loadMedicines = (searchValue, pageValue) => {
    setLoading(true);
    const params = { limit: 20, page: pageValue };
    if (searchValue) params.search = searchValue;
    if (lowStock) params.lowStock = 'true';
    if (expiringSoon) params.expiringSoon = 'true';

    api
      .get('/admin/medicines', { params })
      .then((res) => {
        setMedicines(res.data.medicines);
        setPagination(res.data.pagination);
        setLowStockThreshold(res.data.lowStockThreshold);
      })
      .catch((err) => showToast(err.response?.data?.message || 'Could not load medicines', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // A new search term or filter invalidates whatever page we were on —
    // start back at page 1 so results aren't a page into a now-different list.
    setPage(1);
  }, [search, lowStock, expiringSoon]);

  useEffect(() => {
    // Debounce search-as-you-type so every keystroke doesn't fire a request
    const timer = setTimeout(() => loadMedicines(search, page), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, lowStock, expiringSoon, page]);

  const stockLabel = (medicine) => {
    if (medicine.isDiscontinued) return { text: 'Discontinued', className: 'badge-outofstock' };
    if (medicine.stock <= 0) return { text: 'Out of stock', className: 'badge-outofstock' };
    if (medicine.stock <= lowStockThreshold) return { text: `Low · ${medicine.stock}`, className: 'badge-rx' };
    return { text: `${medicine.stock} in stock`, className: 'badge-success' };
  };

  const handleRestock = async (medicine) => {
    const input = window.prompt(`Add how many units to "${medicine.name}"? (current stock: ${medicine.stock})`, '20');
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isInteger(amount) || amount <= 0) {
      showToast('Enter a whole number greater than 0', 'error');
      return;
    }

    setBusyId(medicine._id);
    try {
      const res = await api.patch(`/admin/medicines/${medicine._id}/restock`, { amount });
      setMedicines((prev) => prev.map((m) => (m._id === medicine._id ? res.data.medicine : m)));
      showToast(res.data.message, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not restock', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (medicine) => {
    if (!window.confirm(`Permanently delete "${medicine.name}"? This can't be undone. If it has ever been sold, use Discontinue instead.`)) return;

    setBusyId(medicine._id);
    try {
      await api.delete(`/admin/medicines/${medicine._id}`);
      showToast('Medicine removed from inventory', 'success');
      loadMedicines(search, page);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete medicine', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleDiscontinue = async (medicine) => {
    const nextValue = !medicine.isDiscontinued;
    setBusyId(medicine._id);
    try {
      const res = await api.patch(`/admin/medicines/${medicine._id}`, { isDiscontinued: nextValue });
      setMedicines((prev) => prev.map((m) => (m._id === medicine._id ? res.data.medicine : m)));
      showToast(nextValue ? 'Medicine discontinued' : 'Medicine reactivated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update medicine', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const clearFilter = () => setSearchParams({});

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicine-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so selecting the same file again still fires onChange
    if (!file) return;

    setImporting(true);
    try {
      const csvText = await file.text();
      const res = await api.post('/admin/medicines/bulk-import', { csv: csvText });
      const { created, updated, skipped, errors } = res.data;
      showToast(
        `Imported ${created + updated} medicine${created + updated === 1 ? '' : 's'} (${created} new, ${updated} updated)` +
          (skipped ? ` — ${skipped} row${skipped === 1 ? '' : 's'} skipped` : ''),
        skipped > 0 ? 'error' : 'success'
      );
      if (errors?.length) {
        // The toast already gives the count — log the specific reasons for
        // an admin who wants to go fix the source file's bad rows.
        console.warn('Bulk import skipped rows:', errors);
      }
      setPage(1);
      loadMedicines(search, 1);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not import CSV', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="admin-orders-page admin-theme">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Medicines</h2>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="btn-secondary admin" onClick={handleDownloadTemplate}>
            <Download size={14} strokeWidth={2} /> CSV Template
          </button>
          <button type="button" className="btn-secondary admin" onClick={handleImportClick} disabled={importing}>
            <Upload size={14} strokeWidth={2} /> {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />
          <Link to="/admin/medicines/new" className="btn-primary">
            <Plus size={16} strokeWidth={2} /> Add Medicine
          </Link>
        </div>
      </div>

      {(lowStock || expiringSoon) && (
        <div className="notice-banner admin-filter-banner">
          Showing only {lowStock ? 'low-stock' : 'expiring-soon'} medicines.
          <button className="icon-btn-danger" onClick={clearFilter} title="Clear filter">
            <X size={14} strokeWidth={2} /> Clear
          </button>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <IconInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, manufacturer, or composition"
        />
      </div>

      {loading ? (
        <p className="info-text center-text">Loading medicines…</p>
      ) : medicines.length === 0 ? (
        <p className="info-text center-text">No medicines found.</p>
      ) : (
        <div className="admin-orders-table">
          {medicines.map((medicine) => {
            const stock = stockLabel(medicine);
            const busy = busyId === medicine._id;
            return (
              <div className="admin-order-row" key={medicine._id}>
                <div className="admin-order-main">
                  <p className="order-invoice">{medicine.name}</p>
                  <p className="muted-text">
                    {medicine.brand || medicine.manufacturer || 'No brand'}
                    {medicine.category ? ` · ${medicine.category}` : ''}
                  </p>
                  <p className="muted-text">₹{Number(medicine.price || 0).toFixed(2)}</p>
                </div>

                <span className={`badge ${stock.className}`}>{stock.text}</span>

                <div className="admin-medicine-actions">
                  <button
                    className="icon-btn-danger"
                    onClick={() => handleRestock(medicine)}
                    disabled={busy}
                    title="Refill stock"
                  >
                    <PackagePlus size={16} strokeWidth={2} />
                  </button>

                  <Link className="icon-btn-danger" to={`/admin/medicines/${medicine._id}/edit`} title="Edit medicine">
                    <Pencil size={16} strokeWidth={2} />
                  </Link>

                  <button
                    className="icon-btn-danger"
                    onClick={() => handleToggleDiscontinue(medicine)}
                    disabled={busy}
                    title={medicine.isDiscontinued ? 'Reactivate — make available for sale again' : 'Discontinue — remove from sale, keep history'}
                  >
                    {medicine.isDiscontinued ? <RotateCcw size={16} strokeWidth={2} /> : <Ban size={16} strokeWidth={2} />}
                  </button>

                  <button
                    className="icon-btn-danger"
                    onClick={() => handleDelete(medicine)}
                    disabled={busy}
                    title="Delete medicine"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && pagination.total > 0 && (
        <div className="pagination-bar">
          <span className="muted-text">
            {pagination.total} medicine{pagination.total === 1 ? '' : 's'} · page {pagination.page} of {pagination.pages}
          </span>
          <div className="pagination-controls">
            <button
              className="btn-secondary admin"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={14} strokeWidth={2} /> Prev
            </button>
            <button
              className="btn-secondary admin"
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
            >
              Next <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMedicines;

