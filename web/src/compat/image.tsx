import type { ImgHTMLAttributes } from "react";
export default function Image({
  fill,
  priority,
  unoptimized,
  quality,
  style,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  quality?: number;
}) {
  return (
    <img
      {...props}
      loading={priority ? "eager" : (props.loading ?? "lazy")}
      decoding="async"
      style={
        fill
          ? {
              position: "absolute",
              height: "100%",
              width: "100%",
              inset: 0,
              ...style,
            }
          : style
      }
    />
  );
}
