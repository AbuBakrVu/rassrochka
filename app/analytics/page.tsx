import { PageHeader, Card, Skeleton } from "@/components/ui";

// Демонстрация состояния загрузки: отчёты «собираются»
export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Аналитика"
        subtitle="Динамика портфеля, собираемость и когорты"
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <p
          className="mb-4 text-sm text-mute"
          role="status"
          aria-live="polite"
        >
          Собираем отчёт за август — обычно это занимает пару секунд.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-32" />
              <Skeleton className="mt-2 h-4 w-20" />
            </Card>
          ))}
        </div>
        <Card className="mt-4 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-4 h-56 w-full" />
        </Card>
      </div>
    </>
  );
}
