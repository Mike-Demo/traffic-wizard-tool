import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Globe2, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Analytics Traffic Simulator · Real Browsers, Real Geos" },
      {
        name: "description",
        content:
          "Drive real BrowserStack sessions from many browsers, devices and countries at a site you own, then compare what your analytics tool reports.",
      },
      { property: "og:title", content: "Analytics Traffic Simulator" },
      {
        property: "og:description",
        content:
          "Test your analytics setup with genuine browser sessions across devices and regions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
      <div className="mb-10 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          analytics traffic simulator
        </span>
      </div>

      <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
        Real browsers. Real regions.
        <span className="block text-primary">Verifiable analytics.</span>
      </h1>

      <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
        Point the console at a site you own, pick a mix of browsers, devices and countries, and
        watch genuine BrowserStack sessions walk your pages. Then check whether your analytics tool
        recorded what actually happened.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/console">Open the console</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        <Feature
          icon={<MonitorSmartphone className="h-5 w-5 text-primary" />}
          title="Browser mix"
          body="Chrome, Safari, Firefox and Edge across Windows, macOS, iPhone and Android hardware."
        />
        <Feature
          icon={<Globe2 className="h-5 w-5 text-primary" />}
          title="Regional traffic"
          body="Sessions routed through real regional IPs so geo reports get something meaningful."
        />
        <Feature
          icon={<ShieldCheck className="h-5 w-5 text-primary" />}
          title="Owner-confirmed"
          body="Every run records the target domain and your authorization. Testing only, never fraud."
        />
      </div>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-5">
      {icon}
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
