// Mock Photo Service - No Network Calls
export interface Photo {
  id: string;
  workOrderId: string;
  kind: 'TENANT_SUBMITTED' | 'MANAGER_NOTE' | 'TECH_BEFORE' | 'TECH_DURING' | 'TECH_AFTER';
  storageKey: string;
  url: string;
  role: 'TENANT' | 'MANAGER' | 'TECH';
  createdAt: string;
  createdBy: string;
}

export interface PhotoGroups {
  before: Photo[];
  during: Photo[];
  after: Photo[];
  tenant: Photo[];
  manager: Photo[];
}

class MockPhotoService {
  private photos: Map<string, Photo[]> = new Map();

  constructor() {
    // Seed with demo data
    this.seedDemoData();
  }

  private seedDemoData() {
    const demoPhotos: Photo[] = [
      {
        id: 'demo-1',
        workOrderId: 'wo-demo-1',
        kind: 'TENANT_SUBMITTED',
        storageKey: 'demo/tenant_1.jpg',
        url: 'https://picsum.photos/400/300?random=1',
        role: 'TENANT',
        createdAt: new Date().toISOString(),
        createdBy: 'demo-tenant'
      },
      {
        id: 'demo-2',
        workOrderId: 'wo-demo-1',
        kind: 'TECH_BEFORE',
        storageKey: 'demo/tech_before.jpg',
        url: 'https://picsum.photos/400/300?random=2',
        role: 'TECH',
        createdAt: new Date().toISOString(),
        createdBy: 'demo-tech'
      }
    ];

    this.photos.set('wo-demo-1', demoPhotos);
  }

  async list(workOrderId: string): Promise<PhotoGroups> {
    const photos = this.photos.get(workOrderId) || [];

    return {
      before: photos.filter(p => p.kind === 'TECH_BEFORE'),
      during: photos.filter(p => p.kind === 'TECH_DURING'),
      after: photos.filter(p => p.kind === 'TECH_AFTER'),
      tenant: photos.filter(p => p.kind === 'TENANT_SUBMITTED'),
      manager: photos.filter(p => p.kind === 'MANAGER_NOTE')
    };
  }

  async requestUpload(kind: Photo['kind']): Promise<{uploadUrl: string; storageKey: string}> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    return {
      uploadUrl: `https://fake-storage.example.com/upload/${timestamp}`,
      storageKey: `demo/${kind.toLowerCase()}_${random}.jpg`
    };
  }

  async upload(uploadUrl: string, file: File): Promise<string> {
    // Simulate upload with progress
    const delay = Math.random() * 500 + 300; // 300-800ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Return mock URL
    return `https://picsum.photos/400/300?random=${Date.now()}`;
  }

  async saveMeta(workOrderId: string, kind: Photo['kind'], storageKey: string, role: Photo['role'], url: string): Promise<Photo> {
    const photo: Photo = {
      id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workOrderId,
      kind,
      storageKey,
      url,
      role,
      createdAt: new Date().toISOString(),
      createdBy: `demo-${role.toLowerCase()}`
    };

    const existing = this.photos.get(workOrderId) || [];
    existing.push(photo);
    this.photos.set(workOrderId, existing);

    return photo;
  }

  getPhotoCount(workOrderId: string): {before: number; during: number; after: number} {
    const photos = this.photos.get(workOrderId) || [];
    return {
      before: photos.filter(p => p.kind === 'TECH_BEFORE').length,
      during: photos.filter(p => p.kind === 'TECH_DURING').length,
      after: photos.filter(p => p.kind === 'TECH_AFTER').length
    };
  }
}

export const mockPhotoService = new MockPhotoService();