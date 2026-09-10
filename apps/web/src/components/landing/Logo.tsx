export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 font-bold text-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span style={{ fontSize: size * 0.6 }}>Z</span>
    </div>
  );
}
