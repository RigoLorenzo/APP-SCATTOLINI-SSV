import { useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import VehicleCard from '../VehicleCard';
import Modal from '../Common/Modal';

const DayDetailModal = ({ date, vehicles, onClose, onEdit, onDelete, onCopy, highlightedVehicleId }) => {
  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const highlightedRef = useRef(null);

  useEffect(() => {
    if (highlightedVehicleId && highlightedRef.current) {
      const timer = setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightedVehicleId]);

  return (
    <Modal
      title={
        <div>
          <h2 className="text-2xl font-bold">{dayNames[date.getDay()]}</h2>
          <p className="text-lg opacity-90">{date.getDate()} {monthNames[date.getMonth()]} {date.getFullYear()}</p>
          <p className="text-sm opacity-75 mt-1">{vehicles.length} veicoli programmati</p>
        </div>
      }
      headerColor="blue"
      onClose={onClose}
      closeIconSize={32}
      closeButtonClassName="text-white hover:text-gray-200"
      size="6xl"
      shadow="2xl"
      overlayClassName="bg-black bg-opacity-60"
      className="max-h-[90vh] overflow-y-auto"
      headerPadding="p-6"
      headerAlign="start"
      headerClassName="sticky top-0 z-10"
    >
      {vehicles.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={64} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nessun veicolo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(vehicle => (
            <div
              key={vehicle.id}
              ref={vehicle.id === highlightedVehicleId ? highlightedRef : null}
            >
              <VehicleCard
                variant="detail"
                vehicle={vehicle}
                onEdit={onEdit}
                onDelete={onDelete}
                onCopy={onCopy}
                isHighlighted={vehicle.id === highlightedVehicleId}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default DayDetailModal;
