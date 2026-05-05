import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Painel Operacional — WKU · WMG · WDU" },
      { name: "description", content: "Dashboard consolidado de separação, checkout e expedição a partir das planilhas WKU, WMG e WDU." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Painel Operacional — WKU · WMG · WDU" },
      { property: "og:description", content: "Dashboard consolidado de separação, checkout e expedição a partir das planilhas WKU, WMG e WDU." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Painel Operacional — WKU · WMG · WDU" },
      { name: "twitter:description", content: "Dashboard consolidado de separação, checkout e expedição a partir das planilhas WKU, WMG e WDU." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/98cba8d6-8d46-4788-8ddd-b4dd07dc6824/id-preview-2097eb63--d0c88a16-b07d-4588-af25-b1365d4cdc38.lovable.app-1777987262568.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/98cba8d6-8d46-4788-8ddd-b4dd07dc6824/id-preview-2097eb63--d0c88a16-b07d-4588-af25-b1365d4cdc38.lovable.app-1777987262568.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
