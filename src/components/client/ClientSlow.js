'use client';

export const ClientSlow = async () => {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log('cc22');
  // const [content] = useState("Slow client leaf");
  return <div>Slow client leaf</div>;
};
