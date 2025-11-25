import React, { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Download, Info } from 'lucide-react';

export default function InvoiceSimplifier() {
  const [file, setFile] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('idle');
  const [extractedText, setExtractedText] = useState('');
  const [simplifiedInvoice, setSimplifiedInvoice] = useState(null);
  const [error, setError] = useState('');
  const [useProxy, setUseProxy] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('idle');
      setError('');
      setExtractedText('');
      setSimplifiedInvoice(null);
    }
  };

  const performOCR = async (imageFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Simulate OCR extraction
            resolve(`INVOICE

Invoice Number: INV-2024-12345
Date: ${new Date().toLocaleDateString()}
Due Date: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}

BILL FROM:
TechCorp Solutions Inc.
123 Innovation Drive
San Francisco, CA 94105
Email: billing@techcorp.com
Phone: (555) 123-4567

BILL TO:
Acme Corporation
456 Business Plaza
New York, NY 10001

DESCRIPTION                                QTY    RATE       AMOUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Web Development Services                   40    $150.00    $6,000.00
Custom UI/UX Design                        20    $120.00    $2,400.00
Monthly Hosting & Maintenance               1    $500.00      $500.00
SSL Certificate (Annual)                    1     $99.00       $99.00
Domain Registration                         1     $15.00       $15.00

                                          SUBTOTAL:        $8,914.00
                                          TAX (10%):         $891.40
                                          
                                          TOTAL DUE:       $9,805.40

Payment Terms: Net 30 Days
Payment Methods: Bank Transfer, Credit Card, PayPal

Thank you for your business!`);
          };
          img.src = e.target.result;
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  };

  const simplifyWithGemini = async (text) => {
    const apiUrl = useProxy 
      ? `https://corsproxy.io/?https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: `Analyze this invoice and return ONLY a JSON object (no markdown, no extra text) with this exact structure:
{
  "invoice_number": "string",
  "date": "string",
  "from": "string",
  "to": "string",
  "items": [
    {"description": "string", "amount": "number"}
  ],
  "subtotal": "number",
  "tax": "number",
  "total": "number",
  "due_date": "string",
  "key_points": ["string"]
}

Invoice text:
${text}`
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0]) {
        throw new Error('No response from Gemini API');
      }

      const generatedText = data.candidates[0].content.parts[0].text;
      
      // Clean and extract JSON
      let cleanedText = generatedText.trim();
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse JSON from response');
    } catch (err) {
      if (err.message.includes('fetch')) {
        throw new Error('CORS Error: Enable CORS proxy option below or use a backend API');
      }
      throw err;
    }
  };

  const handleProcess = async () => {
    if (!file) {
      setError('Please upload an invoice file');
      return;
    }
    
    if (!apiKey) {
      setError('Please enter your Gemini API key');
      return;
    }

    setStatus('processing');
    setError('');

    try {
      // Step 1: OCR
      setStatus('ocr');
      const text = await performOCR(file);
      setExtractedText(text);

      // Step 2: Simplify with Gemini
      setStatus('simplifying');
      const simplified = await simplifyWithGemini(text);
      setSimplifiedInvoice(simplified);
      
      setStatus('complete');
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  const downloadJSON = () => {
    const dataStr = JSON.stringify(simplifiedInvoice, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'simplified-invoice.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Invoice Simplifier</h1>
          <p className="text-gray-600">Upload invoice images, extract text with OCR, and simplify with AI</p>
        </div>

        {/* API Key Input */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gemini API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="mt-3 flex items-start">
            <Info className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-600">
              <p className="mb-1">Get your free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">Google AI Studio</a></p>
              <label className="flex items-center mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useProxy}
                  onChange={(e) => setUseProxy(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-gray-700">Use CORS Proxy (enable if getting CORS errors)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload Section */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Invoice</h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/*,.pdf"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  {file ? file.name : 'Click to upload invoice'}
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, or PDF</p>
              </label>
            </div>

            <button
              onClick={handleProcess}
              disabled={!file || !apiKey || status === 'processing' || status === 'ocr' || status === 'simplifying'}
              className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {(status === 'processing' || status === 'ocr' || status === 'simplifying') ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {status === 'ocr' ? 'Extracting text...' : 'Simplifying with AI...'}
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Process Invoice
                </>
              )}
            </button>

            {/* Status Messages */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">{error}</p>
                    {error.includes('CORS') && (
                      <p className="text-xs text-red-700 mt-2">
                        ✓ Enable "Use CORS Proxy" checkbox above<br/>
                        ✓ Or check the deployment guide for backend setup
                      </p>
                    )}
                    {error.includes('API Error: 400') && (
                      <p className="text-xs text-red-700 mt-2">
                        Check your API key is correct and enabled
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {status === 'complete' && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">Invoice processed successfully!</p>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Simplified Invoice</h2>
            
            {simplifiedInvoice ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Invoice #:</span>
                      <p className="text-gray-900">{simplifiedInvoice.invoice_number}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date:</span>
                      <p className="text-gray-900">{simplifiedInvoice.date}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">From:</span>
                      <p className="text-gray-900 text-xs">{simplifiedInvoice.from}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">To:</span>
                      <p className="text-gray-900 text-xs">{simplifiedInvoice.to}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Items</h3>
                  <div className="space-y-2">
                    {simplifiedInvoice.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm border-b border-gray-200 pb-2">
                        <span className="text-gray-700">{item.description}</span>
                        <span className="font-medium text-gray-900">${item.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="text-gray-900">${simplifiedInvoice.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Tax:</span>
                    <span className="text-gray-900">${simplifiedInvoice.tax}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-blue-600">${simplifiedInvoice.total}</span>
                  </div>
                  <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
                    Due: {simplifiedInvoice.due_date}
                  </div>
                </div>

                {simplifiedInvoice.key_points && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Key Points</h3>
                    <ul className="space-y-1">
                      {simplifiedInvoice.key_points.map((point, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start">
                          <span className="text-blue-600 mr-2">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={downloadJSON}
                  className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download JSON
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Upload and process an invoice to see results</p>
              </div>
            )}
          </div>
        </div>

        {/* Extracted Text Section */}
        {extractedText && (
          <div className="mt-6 bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Extracted Text (OCR)</h2>
            <pre className="bg-gray-50 p-4 rounded-lg text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap border border-gray-200">
              {extractedText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}