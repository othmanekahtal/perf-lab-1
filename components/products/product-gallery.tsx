'use client';

import Image from 'next/image';
import { useState } from 'react';
import { productImage } from '@/lib/format';

export function ProductGallery({ images, name }: { images: number[]; name: string }) {
  const [active, setActive] = useState(images[0]);
  return (
    <div className="space-y-3" data-testid="product-gallery">
      <Image
        src={productImage(active)} alt={name} width={1600} height={1600} sizes="(min-width: 1024px) 600px, 100vw" preload
        className="aspect-square w-full rounded-xl object-cover" data-testid="product-hero"
      />
      <div className="grid grid-cols-4 gap-2">
        {images.map((img) => (
          <button key={img} onClick={() => setActive(img)} className={`overflow-hidden rounded-lg border-2 ${img === active ? 'border-brand-500' : 'border-transparent'}`} aria-label="Show image">
            <Image src={productImage(img)} alt="" width={1600} height={1600} sizes="(min-width: 1024px) 150px, 25vw" quality={60} className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
