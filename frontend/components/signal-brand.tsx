import "./signal-brand.css";
import { PRODUCT_NAME } from "../lib/product";

export function SignalBrand() {
  return (
    <>
      <span className="sf-brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        {PRODUCT_NAME}
        <b>.</b>
      </span>
    </>
  );
}
