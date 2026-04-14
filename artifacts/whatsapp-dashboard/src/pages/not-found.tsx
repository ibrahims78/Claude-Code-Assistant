import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="text-center">
        <h1 className="text-8xl font-bold text-primary opacity-40">404</h1>
        <p className="text-xl font-semibold mt-4 text-foreground">الصفحة غير موجودة</p>
        <Link href="/">
          <button className="mt-6 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all">
            العودة للرئيسية
          </button>
        </Link>
      </div>
    </div>
  );
}
