function Button({ clickManage, children, className = "", type = "button" }) {
  return (
    <button
      type={type}
      className={`bg-green-500 text-white rounded-md px-3 py-2 hover:z-50 whitespace-nowrap ${className}`}
      onClick={typeof clickManage === "function" ? clickManage : undefined}
    >
      {children}
    </button>
  );
}

export default Button;
