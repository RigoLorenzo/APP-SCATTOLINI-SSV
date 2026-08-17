import { useState } from 'react';

/**
 * Menu a tendina generico: trigger (render prop) + lista di item.
 * Estrae il pattern "menu impostazioni" ripetuto a mano in App.jsx
 * (pannello assoluto + overlay trasparente fixed inset-0 per chiudere
 * al click esterno).
 */
const Dropdown = ({ trigger, items, align = 'right', width = 'w-48' }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {trigger({ toggle: () => setOpen(o => !o), open })}
      {open && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 ${width} bg-white rounded-lg shadow-xl border z-50`}>
          <div className="p-2">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => { item.onClick(); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${item.className || 'text-gray-700 hover:bg-gray-50'}`}
              >
                {item.icon && <item.icon size={16} />}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
      )}
    </div>
  );
};

export default Dropdown;
