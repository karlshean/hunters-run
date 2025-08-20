import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = vi.fn();

// Simple component to test photo upload functionality
function PhotoUploadForm() {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('photo') as File;
    
    if (!file) {
      alert('Please select a photo');
      return;
    }

    try {
      // Upload photo first
      const photoFormData = new FormData();
      photoFormData.append('photo', file);
      
      const photoResponse = await fetch('/api/maintenance/photo', {
        method: 'POST',
        headers: {
          'x-org-id': '00000000-0000-4000-8000-000000000001'
        },
        body: photoFormData
      });
      
      if (!photoResponse.ok) {
        throw new Error('Photo upload failed');
      }
      
      const photoResult = await photoResponse.json();
      
      // Create work order with photo key
      const workOrderData = {
        unitId: '00000000-0000-4000-8000-000000000003',
        tenantId: '00000000-0000-4000-8000-000000000004',
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        priority: 'normal' as const,
        photoKey: photoResult.photoKey
      };
      
      const workOrderResponse = await fetch('/api/maintenance/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': '00000000-0000-4000-8000-000000000001'
        },
        body: JSON.stringify(workOrderData)
      });
      
      if (!workOrderResponse.ok) {
        throw new Error('Work order creation failed');
      }
      
      const workOrderResult = await workOrderResponse.json();
      
      // Show success with ticket ID
      alert(`Work order created! Ticket ID: ${workOrderResult.ticketId}`);
      
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="photo-upload-form">
      <div>
        <label htmlFor="photo">Photo:</label>
        <input
          type="file"
          id="photo"
          name="photo"
          accept="image/*"
          data-testid="photo-input"
          required
        />
      </div>
      <div>
        <label htmlFor="title">Issue Title:</label>
        <input
          type="text"
          id="title"
          name="title"
          data-testid="title-input"
          required
        />
      </div>
      <div>
        <label htmlFor="description">Description:</label>
        <textarea
          id="description"
          name="description"
          data-testid="description-input"
        />
      </div>
      <button type="submit" data-testid="submit-button">
        Submit Work Order
      </button>
    </form>
  );
}

describe('Photo Upload Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock alert
    window.alert = vi.fn();
  });

  it('should simulate file select, submit, and assert API called with FormData', async () => {
    // Mock successful API responses
    const mockPhotoResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        photoKey: 'photos/1234567890-test-image.jpg',
        message: 'Photo uploaded successfully',
        fileName: 'test-image.jpg',
        size: 1024,
        mimeType: 'image/jpeg'
      })
    };

    const mockWorkOrderResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'wo-test-123',
        ticketId: 'WO-2025-0001',
        title: 'Test Issue',
        status: 'new'
      })
    };

    (global.fetch as any)
      .mockResolvedValueOnce(mockPhotoResponse)
      .mockResolvedValueOnce(mockWorkOrderResponse);

    render(<PhotoUploadForm />);

    // Get form elements
    const photoInput = screen.getByTestId('photo-input');
    const titleInput = screen.getByTestId('title-input');
    const descriptionInput = screen.getByTestId('description-input');
    const submitButton = screen.getByTestId('submit-button');

    // Create a mock file
    const testFile = new File(['test image content'], 'test-image.jpg', {
      type: 'image/jpeg'
    });

    // Simulate file selection
    fireEvent.change(photoInput, { target: { files: [testFile] } });
    
    // Fill in form fields
    fireEvent.change(titleInput, { target: { value: 'Test Issue' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

    // Submit the form
    fireEvent.click(submitButton);

    // Wait for async operations
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Verify photo upload API call
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/maintenance/photo', {
      method: 'POST',
      headers: {
        'x-org-id': '00000000-0000-4000-8000-000000000001'
      },
      body: expect.any(FormData)
    });

    // Verify work order creation API call
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/maintenance/work-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': '00000000-0000-4000-8000-000000000001'
      },
      body: JSON.stringify({
        unitId: '00000000-0000-4000-8000-000000000003',
        tenantId: '00000000-0000-4000-8000-000000000004',
        title: 'Test Issue',
        description: 'Test Description',
        priority: 'normal',
        photoKey: 'photos/1234567890-test-image.jpg'
      })
    });

    // Verify success alert with ticket ID
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Work order created! Ticket ID: WO-2025-0001');
    });
  });

  it('should show error when no file is selected', async () => {
    render(<PhotoUploadForm />);

    const titleInput = screen.getByTestId('title-input');
    const submitButton = screen.getByTestId('submit-button');

    // Fill in title but no photo
    fireEvent.change(titleInput, { target: { value: 'Test Issue' } });
    fireEvent.click(submitButton);

    // Should show error alert
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Please select a photo');
    });

    // Should not make any API calls
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle photo upload failure gracefully', async () => {
    // Mock failed photo upload
    const mockFailedResponse = {
      ok: false,
      status: 400
    };

    (global.fetch as any).mockResolvedValueOnce(mockFailedResponse);

    render(<PhotoUploadForm />);

    const photoInput = screen.getByTestId('photo-input');
    const titleInput = screen.getByTestId('title-input');
    const submitButton = screen.getByTestId('submit-button');

    // Create test file and fill form
    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(photoInput, { target: { files: [testFile] } });
    fireEvent.change(titleInput, { target: { value: 'Test Issue' } });
    fireEvent.click(submitButton);

    // Should show error alert
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Error: Photo upload failed');
    });

    // Should only call photo upload API
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});