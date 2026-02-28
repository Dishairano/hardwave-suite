'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateInvoicePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main invoicing page which has the create modal
    router.replace('/erp/invoicing');
  }, [router]);

  return null;
}
