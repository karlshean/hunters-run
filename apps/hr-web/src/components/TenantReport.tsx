import React, { useState, useRef, useEffect } from 'react';
import { RoleSwitcher } from './RoleSwitcher';
import { useFlags } from '../lib/useFlags';

interface PhotoState {
  file: File | null;
  previewUrl: string | null;
  isUploading: boolean;
}

export function TenantReport() {
  const flags = useFlags();
  const [photo, setPhoto] = useState<PhotoState>({ file: null, previewUrl: null, isUploading: false });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ ticketId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraSupported, setIsCameraSupported] = useState(false);
  const [isUsingCamera, setIsUsingCamera] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check if camera is supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setIsCameraSupported(true);
    }
    
    return () => {
      // Cleanup camera stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsUsingCamera(true);
        setError(null);
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setError('Camera access denied. Please use file upload instead.');
      setIsUsingCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsUsingCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        // Convert to blob and compress if needed
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = await compressImage(blob);
            setPhoto({
              file,
              previewUrl: URL.createObjectURL(file),
              isUploading: false
            });
            stopCamera();
          }
        }, 'image/jpeg', 0.85);
      }
    }
  };

  const compressImage = async (blob: Blob): Promise<File> => {
    const maxSize = 2 * 1024 * 1024; // 2MB
    
    if (blob.size <= maxSize) {
      return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    }

    // Need to compress further
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    return new Promise((resolve) => {
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels to get under 2MB
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (blob && blob.size <= maxSize) {
              resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
            } else if (quality > 0.3) {
              quality -= 0.1;
              tryCompress();
            } else {
              // Last resort: use whatever we have
              resolve(new File([blob!], 'photo.jpg', { type: 'image/jpeg' }));
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.src = URL.createObjectURL(blob);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressedFile = await compressImage(file);
      setPhoto({
        file: compressedFile,
        previewUrl: URL.createObjectURL(compressedFile),
        isUploading: false
      });
      setError(null);
    }
  };

  const uploadToS3 = async (file: File, presignedData: any): Promise<boolean> => {
    try {
      const formData = new FormData();
      
      // Add all fields from presigned POST
      Object.entries(presignedData.fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      
      // File must be added last for S3
      formData.append('file', file);
      
      const response = await fetch(presignedData.url, {
        method: 'POST',
        body: formData
      });
      
      return response.ok || response.status === 204;
    } catch (error) {
      console.error('S3 upload error:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!photo.file) {
      setError('Please capture or select a photo first');
      return;
    }
    
    if (!title.trim()) {
      setError('Please enter a title for the issue');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const orgId = '00000000-0000-4000-8000-000000000001';
      
      // Step 1: Get presigned URL
      const presignResponse = await fetch('/api/files/presign-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId
        },
        body: JSON.stringify({
          fileName: photo.file.name,
          fileSize: photo.file.size,
          mimeType: photo.file.type
        })
      });
      
      if (!presignResponse.ok) {
        throw new Error('Failed to get upload URL');
      }
      
      const presignData = await presignResponse.json();
      
      // Step 2: Upload to S3
      const uploadSuccess = await uploadToS3(photo.file, presignData.presignedPost);
      
      if (!uploadSuccess) {
        throw new Error('Failed to upload photo');
      }
      
      // Step 3: Create work order with photo metadata
      const workOrderResponse = await fetch('/api/maintenance/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId
        },
        body: JSON.stringify({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: title.trim(),
          description: description.trim(),
          priority,
          photoMetadata: {
            s3Key: presignData.s3Key,
            sizeBytes: photo.file.size,
            mimeType: photo.file.type
          }
        })
      });
      
      if (!workOrderResponse.ok) {
        throw new Error('Failed to create work order');
      }
      
      const workOrder = await workOrderResponse.json();
      setSuccess({ ticketId: workOrder.ticketId });
      
      // Reset form
      setPhoto({ file: null, previewUrl: null, isUploading: false });
      setTitle('');
      setDescription('');
      setPriority('normal');
      setRetryCount(0);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // Auto-retry once on failure
      if (retryCount === 0) {
        setRetryCount(1);
        setTimeout(() => {
          handleSubmit(e);
        }, 1000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Request Submitted!
            </h1>
            <p className="text-lg text-gray-700 mb-4">
              Ticket ID: <span className="font-mono font-bold">{success.ticketId}</span>
            </p>
            <p className="text-green-600 font-semibold mb-6">
              Photo attached ✅
            </p>
            <button
              onClick={() => setSuccess(null)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check feature flag
  if (!flags) return null; // Loading flags
  
  if (!flags.photoFlowEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Report Issue</h1>
            <RoleSwitcher className="role-switch" />
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-500 mb-4">📷</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Photo Feature Not Available</h2>
            <p className="text-gray-600 mb-4">
              The photo reporting feature is currently disabled. 
              Please use the standard tenant portal to submit maintenance requests.
            </p>
            <a 
              href="/tenant" 
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Go to Tenant Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Report Issue</h1>
          <RoleSwitcher className="role-switch" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Capture Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">
              Step 1: Take a Photo
            </h2>
            
            {!photo.file && !isUsingCamera && (
              <div className="space-y-3">
                {isCameraSupported && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                  >
                    <span className="mr-2">📷</span> Use Camera
                  </button>
                )}
                
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition flex items-center justify-center"
                  >
                    <span className="mr-2">📁</span> Choose File
                  </button>
                </div>
              </div>
            )}
            
            {isUsingCamera && (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg bg-black"
                />
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition"
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {photo.previewUrl && (
              <div className="space-y-3">
                <img
                  src={photo.previewUrl}
                  alt="Captured"
                  className="w-full rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto({ file: null, previewUrl: null, isUploading: false });
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                >
                  Retake Photo
                </button>
              </div>
            )}
            
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Details Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">
              Step 2: Describe the Issue
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Bathroom sink leaking"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any additional details..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
              {retryCount > 0 && ' (Retrying...)'}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!photo.file || !title.trim() || isSubmitting}
            className={`w-full px-6 py-3 rounded-lg font-semibold transition ${
              !photo.file || !title.trim() || isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
}