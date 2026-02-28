'use client';

import { useState, useEffect, use } from 'react';
import { CheckCircle, FileText, XCircle, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SignatureCanvas from '@/components/erp/SignatureCanvas';

interface ContractData {
  id: number;
  title: string;
  document_type: string;
  description: string | null;
  document_url: string | null;
  status: string;
  external_signer_name: string | null;
  external_signer_email: string | null;
  internal_signer_name: string | null;
  internal_signed_at: string | null;
  sent_to_external_at: string | null;
  created_at: string;
}

export default function PublicSigningPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    fetchContract();
  }, [resolvedParams.token]);

  const fetchContract = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/erp/hr/contracts/public/${resolvedParams.token}`);
      const data = await response.json();

      if (response.ok) {
        setContract(data);
        if (data.external_signer_email) {
          setEmail(data.external_signer_email);
        }
      } else {
        setError(data.error || 'Failed to load contract');
      }
    } catch (err) {
      console.error('Error fetching contract:', err);
      setError('Failed to load contract. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (signatureData: string) => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!contract) return;

    try {
      setSigning(true);
      setError(null);

      const response = await fetch(`/api/erp/hr/contracts/${contract.id}/sign-external`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_data: signatureData,
          email: email,
          token: resolvedParams.token,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSigned(true);
      } else {
        setError(data.error || 'Failed to sign contract');
      }
    } catch (err) {
      console.error('Error signing contract:', err);
      setError('Failed to sign contract. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-12 text-center max-w-md w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading contract...</p>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-12 text-center max-w-2xl w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Contract Signed Successfully!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for signing {contract?.title}. A confirmation email with a copy of the fully executed document
            has been sent to your email address.
          </p>
          <Alert className="mb-6">
            <AlertDescription>
              All parties have now signed this document. Please check your email for the final copy.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-gray-500">
            You can safely close this page.
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-12 text-center max-w-2xl w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Unable to Load Contract</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact Hardwave Studios for assistance.
          </p>
        </Card>
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-white">H</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Hardwave Studios</h1>
          <p className="text-gray-600">Document Signature Request</p>
        </div>

        {/* Contract Info */}
        <Card className="p-8 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{contract.title}</h2>
              {contract.description && (
                <p className="text-gray-600 mb-4">{contract.description}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span>
                  Type: {contract.document_type.split('_').map(w =>
                    w.charAt(0).toUpperCase() + w.slice(1)
                  ).join(' ')}
                </span>
                {contract.internal_signer_name && (
                  <span>From: {contract.internal_signer_name}</span>
                )}
              </div>
            </div>
          </div>

          {contract.document_url && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please review the document before signing.
                <Button
                  variant="link"
                  onClick={() => window.open(contract.document_url!, '_blank')}
                  className="ml-2 p-0 h-auto text-orange-600"
                >
                  <Download className="w-4 h-4 mr-1" />
                  View Document
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            <div>
              <Label htmlFor="email">Your Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={signing}
              />
              <p className="text-xs text-gray-500 mt-1">
                Must match the email address this invitation was sent to
              </p>
            </div>

            <div>
              <Label>Your Signature *</Label>
              <p className="text-sm text-gray-600 mb-4">
                By signing below, you acknowledge that you have read and agree to the terms of this document.
              </p>
              <SignatureCanvas
                onSave={handleSign}
              />
            </div>
          </div>
        </Card>

        {/* Footer */}
        <Card className="p-6 bg-gray-50">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">
              This is a secure document signing page provided by Hardwave Studios.
            </p>
            <p>
              If you have any questions about this document, please contact Hardwave Studios directly.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
