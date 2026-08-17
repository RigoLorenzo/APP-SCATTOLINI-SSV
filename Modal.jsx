import { X } from 'lucide-react';

const HEADER_GRADIENT = {
  blue: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white',
  red: 'bg-gradient-to-r from-red-600 to-red-700 text-white',
  green: 'bg-gradient-to-r from-green-600 to-green-700 text-white',
  'blue-dark': 'bg-gradient-to-r from-blue-700 to-blue-800 text-white',
  white: 'bg-white border-b',
};

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
};

const ROUNDED_CLASS = { lg: { card: 'rounded-lg', top: 'rounded-t-lg', bottom: 'rounded-b-lg' }, '2xl': { card: 'rounded-2xl', top: 'rounded-t-2xl', bottom: 'rounded-b-2xl' } };
const SHADOW_CLASS = { xl: 'shadow-xl', '2xl': 'shadow-2xl' };

/**
 * Shell condiviso per i modali dell'app: overlay + card + header opzionale
 * (colorato a gradiente o "white" in stile VehicleModal) + body + footer.
 * headerColor assente => nessun header renderizzato (es. ConfirmModal).
 */
const Modal = ({
  isOpen = true,
  onClose,
  title,
  headerColor,
  footer,
  children,
  size = 'md',
  rounded = 'lg',
  shadow = 'xl',
  headerPadding = 'p-4',
  headerAlign = 'center',
  footerPadding = 'p-4',
  className = '',
  headerClassName = '',
  bodyClassName = 'p-6',
  footerClassName = '',
  overlayClassName = 'bg-black bg-opacity-50',
  closeIconSize = 24,
  closeButtonClassName,
  disableClose = false,
  style,
  zIndexClass = 'z-50',
}) => {
  if (!isOpen) return null;

  const sizeClass = SIZE_CLASS[size] || size;
  const roundedClass = ROUNDED_CLASS[rounded] || ROUNDED_CLASS.lg;
  const shadowClass = SHADOW_CLASS[shadow] || SHADOW_CLASS.xl;
  const alignClass = headerAlign === 'start' ? 'items-start' : 'items-center';
  const hasHeader = title !== undefined && title !== null;
  const headerStyle = HEADER_GRADIENT[headerColor] || HEADER_GRADIENT.white;
  const defaultCloseClass = headerColor && headerColor !== 'white'
    ? 'text-white'
    : 'text-gray-500 hover:text-gray-700';

  return (
    <div className={`fixed inset-0 ${overlayClassName} flex items-center justify-center ${zIndexClass} p-4`}>
      <div className={`bg-white ${roundedClass.card} ${shadowClass} ${sizeClass} w-full ${className}`} style={style}>
        {hasHeader && (
          <div className={`${headerPadding} flex justify-between ${alignClass} ${roundedClass.top} ${headerStyle} ${headerClassName}`}>
            <div className="flex-1 min-w-0">{title}</div>
            {onClose && (
              <button
                onClick={onClose}
                disabled={disableClose}
                className={closeButtonClassName || defaultCloseClass}
              >
                <X size={closeIconSize} />
              </button>
            )}
          </div>
        )}
        <div className={bodyClassName}>
          {children}
        </div>
        {footer && (
          <div className={`${footerPadding} flex gap-3 ${roundedClass.bottom} ${footerClassName}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
