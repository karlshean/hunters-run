import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface WorkOrderData {
  title: string;
  description: string;
  priority: 'normal' | 'urgent' | 'emergency';
  unit_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_photo_s3_key?: string;
  tenant_photo_filename?: string;
}

interface Unit {
  id: string;
  name: string;
}

// Image compression function
async function compressImage(file: File, maxWidth = 1920, quality = 0.8, maxSizeMB = 2): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      const tryCompress = (currentQuality: number, attempt = 1) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'));
              return;
            }
            
            const sizeMB = blob.size / (1024 * 1024);
            if (sizeMB <= maxSizeMB || attempt >= 3 || currentQuality <= 0.3) {
              resolve(new File([blob], file.name, { type: blob.type }));
            } else {
              // Try with lower quality
              tryCompress(currentQuality - 0.1, attempt + 1);
            }
          },
          file.type,
          currentQuality
        );
      };
      
      tryCompress(quality);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Phone number normalization to E.164
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle US numbers (add country code if missing)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }
  
  // Return with + if it looks like international
  if (digits.length > 10) {
    return `+${digits}`;
  }
  
  return phone; // Return original if can't normalize
}

// API helper with retry logic
async function apiCallWithRetry(
  method: string,
  path: string,
  body?: any,
  maxRetries = 3
): Promise<any> {
  const delays = [1000, 2000, 4000]; // Exponential backoff
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'x-org-id': '00000000-0000-4000-8000-000000000001'
        },
        mode: 'cors'
      };
      
      if (body) {
        if (body instanceof FormData) {
          options.body = body;
        } else {
          options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
          };
          options.body = JSON.stringify(body);
        }
      }
      
      const res = await fetch(`http://localhost:3001${path}`, options);
      
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
      }
      
      return res.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
}

export function TenantSubmit() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [photoS3Key, setPhotoS3Key] = useState<string | null>(null);
  
  const [units, setUnits] = useState<Unit[]>([]);
  const [formData, setFormData] = useState<Partial<WorkOrderData>>({
    unit_id: '',
    priority: 'normal',
    description: '',
    tenant_name: '',
    tenant_phone: ''
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  
  // Load units on mount
  useEffect(() => {
    loadUnits();
    // Auto-open camera on load
    setTimeout(() => {
      if (fileInputRef.current && !photo) {
        fileInputRef.current.click();
      }
    }, 500);
  }, []);
  
  async function loadUnits() {
    try {
      const data = await apiCallWithRetry('GET', '/api/lookups/units');
      setUnits(data);
    } catch (err) {
      console.error('Failed to load units:', err);
      setError('Failed to load units. Please refresh the page.');
    }
  }
  
  async function handlePhotoCapture(file: File) {
    try {
      setError(null);
      setPhotoUploading(true);
      
      // Compress image
      const compressed = await compressImage(file);
      const sizeMB = (compressed.size / (1024 * 1024)).toFixed(2);
      console.log(`Photo compressed to ${sizeMB}MB`);
      
      // Show preview
      const previewUrl = URL.createObjectURL(compressed);
      setPhotoPreview(previewUrl);
      setPhoto(compressed);
      
      // Get presigned URL
      const presignData = await apiCallWithRetry('POST', '/api/files/presign-photo', {
        fileName: compressed.name,
        mimeType: compressed.type,
        fileSize: compressed.size
      });
      
      // Upload to S3
      const formData = new FormData();
      
      // Add fields in correct order (key should be last before file)
      const fields = presignData.fields;
      Object.entries(fields).forEach(([key, value]) => {
        if (key !== 'key' && key !== 'Key') {
          formData.append(key, value as string);
        }
      });
      
      // Add key field
      if (fields.key) formData.append('key', fields.key);
      if (fields.Key) formData.append('Key', fields.Key);
      
      // Add file last
      formData.append('file', compressed);
      
      // Upload with retry
      const uploadResponse = await fetch(presignData.url, {
        method: 'POST',
        body: formData,
        mode: 'cors'
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.status}`);
      }
      
      setPhotoS3Key(presignData.s3Key);
      setPhotoUploaded(true);
      setPhotoUploading(false);
      
    } catch (err) {
      console.error('Photo upload failed:', err);
      setError('Photo upload failed. Please try again.');
      setPhotoUploading(false);
    }
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.unit_id || !formData.tenant_name || !formData.tenant_phone) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (!photoUploaded || !photoS3Key) {
      setError('Please upload a photo first');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(formData.tenant_phone);
      
      // Generate title from description or default
      const title = formData.description?.substring(0, 50) || 'Maintenance Request';
      
      // Submit work order
      const workOrder = await apiCallWithRetry('POST', '/api/maintenance/work-orders', {
        title,
        description: formData.description || '',
        priority: formData.priority,
        unit_id: formData.unit_id,
        tenant_name: formData.tenant_name,
        tenant_phone: normalizedPhone,
        tenant_photo_s3_key: photoS3Key,
        tenant_photo_filename: photo?.name
      });
      
      setTicketNumber(workOrder.ticketId || workOrder.ticket_number);
      
    } catch (err) {
      console.error('Failed to submit work order:', err);
      setError('Failed to submit request. Please try again.');
      setSubmitting(false);
    }
  }
  
  // Show confirmation page
  if (ticketNumber) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Request Submitted!
            </h1>
            <div className="bg-gray-100 rounded-lg p-6 mb-6">
              <div className="text-sm text-gray-600 mb-2">Ticket Number:</div>
              <div className="text-3xl font-bold text-blue-600">
                {ticketNumber}
              </div>
            </div>
            <p className="text-gray-700 mb-4">
              Thanks! Your request has been submitted.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              We'll respond within 24 hours.
            </p>
            <button
              onClick={() => navigate('/tenant')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Return to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-semibold">Submit Maintenance Request</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4">
        {/* Photo Section */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photo of Issue *
          </label>
          
          {!photoPreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500"
            >
              <div className="text-4xl mb-2">📸</div>
              <div className="text-gray-600">Tap to take photo</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoCapture(file);
                }}
              />
            </div>
          ) : (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Issue photo"
                className="w-full rounded-lg"
              />
              {photoUploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                  <div className="text-white">Uploading...</div>
                </div>
              )}
              {photoUploaded && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-sm">
                  ✓ Uploaded
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setPhotoPreview(null);
                  setPhotoUploaded(false);
                  setPhotoS3Key(null);
                  fileInputRef.current?.click();
                }}
                className="mt-2 text-blue-600 text-sm"
              >
                Retake Photo
              </button>
            </div>
          )}
        </div>
        
        {/* Form Fields */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          {/* Unit */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit *
            </label>
            <select
              value={formData.unit_id}
              onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              <option value="">Select your unit...</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Urgency */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Urgency Level *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, priority: 'normal' })}
                className={`px-3 py-2 rounded-lg border ${
                  formData.priority === 'normal'
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'border-gray-300'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, priority: 'urgent' })}
                className={`px-3 py-2 rounded-lg border ${
                  formData.priority === 'urgent'
                    ? 'bg-orange-100 border-orange-500 text-orange-700'
                    : 'border-gray-300'
                }`}
              >
                Urgent
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, priority: 'emergency' })}
                className={`px-3 py-2 rounded-lg border ${
                  formData.priority === 'emergency'
                    ? 'bg-red-100 border-red-500 text-red-700'
                    : 'border-gray-300'
                }`}
              >
                Emergency
              </button>
            </div>
          </div>
          
          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value.substring(0, 1000) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
              placeholder="Describe the issue..."
              maxLength={1000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {formData.description?.length || 0}/1000 characters
            </div>
          </div>
          
          {/* Tenant Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name *
            </label>
            <input
              type="text"
              value={formData.tenant_name}
              onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          
          {/* Phone Number */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              value={formData.tenant_phone}
              onChange={(e) => setFormData({ ...formData, tenant_phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="(555) 123-4567"
              required
            />
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        
        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !photoUploaded}
          className={`w-full py-3 rounded-lg font-semibold ${
            submitting || !photoUploaded
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}