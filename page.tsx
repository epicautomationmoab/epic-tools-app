type VisitPageProps = {
  params: Promise<{ token: string }>;
};

export default async function VisitPage({ params }: VisitPageProps) {
  const { token } = await params;

  return (
    <main className="home">
      <p className="eyebrow">EpicTools</p>
      <h1>Guest Visit</h1>
      <p>Next build: private guest portal for token {token}.</p>
    </main>
  );
}
