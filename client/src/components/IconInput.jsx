/**
 * A plain input with a leading icon. Pass any lucide-react icon component.
 */
const IconInput = ({ icon: Icon, ...inputProps }) => {
  return (
    <div className="icon-input">
      {Icon && <Icon size={16} className="icon-input-icon" strokeWidth={2} />}
      <input {...inputProps} />
    </div>
  );
};

export default IconInput;
