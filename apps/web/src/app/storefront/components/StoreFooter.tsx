/**
 * ZYRA — Store Builder: StoreFooter Component
 */

export function StoreFooter({ store }: { store: { name: string; pages?: { id: string; title: string; isPublished: boolean }[] } }) {
  const currentYear = new Date().getFullYear();
  const publishedPages = store.pages?.filter((p) => p.isPublished) ?? [];

  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
            <p className="mt-2 text-sm text-gray-500">
              Powered by ZYRA — AI-powered commerce.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Pages
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              {publishedPages.map((page) => (
                <li key={page.id}>
                  <span className="hover:text-gray-900">{page.title}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Legal
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li>
                <span className="hover:text-gray-900 cursor-pointer">Privacy Policy</span>
              </li>
              <li>
                <span className="hover:text-gray-900 cursor-pointer">Terms of Service</span>
              </li>
              <li>
                <span className="hover:text-gray-900 cursor-pointer">Shipping Policy</span>
              </li>
              <li>
                <span className="hover:text-gray-900 cursor-pointer">Return Policy</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
          &copy; {currentYear} {store.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
