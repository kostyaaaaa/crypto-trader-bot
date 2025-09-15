import type { FC, PropsWithChildren } from "react";
import "./CardWrapper.css";

const CardWrapper: FC<PropsWithChildren> = ({ children }) => {
  return <div className="component-card">{children}</div>;
};

export default CardWrapper;
