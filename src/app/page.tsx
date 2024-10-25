import ClientWrapper from '@/components/ui/client-wrapper';
import LapTimer from '@/components/rc-timer/lap-timer';

export default function Home() {
  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="container mx-auto">
        { /* <h1 className="text-3xl font-bold text-center mb-8">RC Lap Timer</h1> */ }
        <ClientWrapper>
          <LapTimer />
        </ClientWrapper>
      </div>
    </main>
  );
}
