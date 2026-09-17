import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 text-slate-600">
      <p className="text-lg font-semibold">Page not found</p>
      <Link to="/" className="text-brand-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
