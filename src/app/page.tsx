import LapTimer from "@/components/rc-timer/lap-timer";
import { DataProvider } from "@/data/provider";

export default function Home() {
  return (
    <main className="min-h-screen sm:p-4 bg-gray-50">
      <div className="container mx-auto px-2 sm:px-8">
        <DataProvider>
          <LapTimer />
        </DataProvider>
      </div>
    </main>
  );
}
