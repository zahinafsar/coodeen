import { avatarColor, initials } from "./providerCatalog";

interface Props {
  id: string;
  name: string;
  size?: number;
}

export function ProviderAvatar({ id, name, size = 28 }: Props) {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center rounded-md text-white text-[10px] font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: avatarColor(id),
      }}
    >
      {initials(name)}
    </div>
  );
}
