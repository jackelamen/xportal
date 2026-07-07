"use client";

// A submit button that asks for confirmation before letting its enclosing
// form post - for destructive admin actions (clearing messages, deleting
// records) where a stray click shouldn't be enough.
export default function ConfirmSubmit({ confirmMessage, className, children }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
