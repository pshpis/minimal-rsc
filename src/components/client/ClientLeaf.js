'use client';
import {useState} from 'react';

export const ClientLeaf = () => {
  const [content, setContent] = useState('I am client leaf');
  return <>[{content}]</>;
};
