'use client';
import {startTransition} from 'react';
import {useRouter} from '../../router';

export default function SidebarNoteContent({}) {
  const {navigate} = useRouter();

  return (
    <nav>
      <div
        onClick={() => {
          startTransition(() => {
            navigate('Page1');
          });
        }}>
        Page One
      </div>
      <div
        onClick={() => {
          startTransition(() => {
            navigate('Page2');
          });
        }}>
        Page Two
      </div>
      <div
        onClick={() => {
          startTransition(() => {
            navigate('Page3');
          });
        }}>
        Page with <code>Suspense</code>
      </div>
    </nav>
  );
}
