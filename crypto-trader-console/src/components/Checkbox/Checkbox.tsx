import type { FC } from "react";

interface ICheckboxProps {
  label: string;
  checked: boolean;
  handleChange: () => void;
}

const Checkbox: FC<ICheckboxProps> = ({ label, checked, handleChange }) => {
  return (
    <label>
      <input type="checkbox" checked={checked} onChange={handleChange} />
      {label}
    </label>
  );
};

export default Checkbox;
