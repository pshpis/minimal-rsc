'use client';

export const ClientSlow = async () => {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return <div>Slow client leaf</div>;
};
