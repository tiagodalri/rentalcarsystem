import { ImgHTMLAttributes } from "react";
import { useSignedInspectionUrl } from "@/lib/inspectionStorage";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  /** Stored value: storage path, legacy public URL, or data URL. */
  value: string | null | undefined;
  fallbackClassName?: string;
};

/**
 * Renders an <img> for files stored in the private `inspections` bucket.
 * Generates a signed URL on demand and refreshes on value change.
 */
export function SignedImage({ value, fallbackClassName, className, alt, ...rest }: Props) {
  const url = useSignedInspectionUrl(value);

  if (!url) {
    return (
      <div
        className={
          fallbackClassName ||
          `${className || ""} bg-muted/40 animate-pulse`
        }
        aria-label={typeof alt === "string" ? alt : undefined}
      />
    );
  }

  return <img src={url} alt={alt} className={className} {...rest} />;
}
