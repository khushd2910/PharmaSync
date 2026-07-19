import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

const PasswordInput = ({ name, placeholder, value, onChange, minLength, required, autoComplete }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="icon-input">
      <Lock size={16} className="icon-input-icon" strokeWidth={2} />
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        minLength={minLength}
        required={required}
        autoComplete={autoComplete}
        className="has-trailing-icon"
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
      </button>
    </div>
  );
};

export default PasswordInput;
