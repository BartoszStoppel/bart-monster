import { forwardRef, type AnchorHTMLAttributes } from "react";
import { navigate } from "./navigation";
export default forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(function Link({ href, onClick, ...props }, ref) {
  return (
    <a
      {...props}
      ref={ref}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.shiftKey &&
          event.button === 0 &&
          (!props.target || props.target === "_self")
        ) {
          event.preventDefault();
          navigate(href);
        }
      }}
    />
  );
});
