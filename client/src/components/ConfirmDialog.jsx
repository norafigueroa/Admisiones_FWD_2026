import Modal from './Modal.jsx';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = 'Confirmar', danger = false }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button
            className={danger ? 'btn-danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
