'use client';

import {Suspense, useState} from 'react';
import {ClientLeaf} from './ClientLeaf';
import {ClientSlow} from './ClientSlow';

export const ClientMother = () => {
  const [client] = useState('I am client, mother');
  console.log('cc11');
  return (
    <div>
      {client} <br />
      <ClientLeaf /> <br />
      <Suspense fallback={<p>Loading slow client...</p>}>
        <ClientSlow />
      </Suspense>
    </div>
  );
};
