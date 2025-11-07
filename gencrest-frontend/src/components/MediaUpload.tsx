import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Play, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MediaUploadProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  existingMedia?: string[];
  autoOpenCamera?: boolean;
  onCancel?: () => void;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({
  onUpload,
  maxFiles = 5,
  acceptedTypes = ['image/*', 'video/*'],
  existingMedia = [],
  autoOpenCamera = false,
  onCancel
}) => {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (autoOpenCamera && !isCameraOpen && !capturedImage) {
      openCamera();
    }
  }, [autoOpenCamera, capturedImage]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (stream && videoRef.current && isCameraOpen) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video in effect:', err);
      });
    }
  }, [stream, isCameraOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);

    const newPreviews = [...previews];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target?.result as string);
        setPreviews([...newPreviews]);
      };
      reader.readAsDataURL(file);
    });

    onUpload(newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
    onUpload(newFiles);
  };

  const openCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);
      setIsCameraOpen(true);

      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions and ensure you are using HTTPS or localhost.');
    }
  };

  const closeCamera = (userCancelled: boolean = false) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);

    // Only call onCancel if user explicitly cancelled (not after capturing)
    if (autoOpenCamera && onCancel && userCancelled) {
      onCancel();
    }
  };

  const addWatermarkToImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const now = new Date();
    const timestamp = now.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const userName = user?.name || 'Unknown User';
    const userRole = user?.role || '';
    const territory = user?.territory || '';

    const padding = 15;
    const lineHeight = 25;
    const fontSize = 18;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const textLines = [
      timestamp,
      userName,
      `${userRole}${territory ? ' | ' + territory : ''}`
    ];

    const maxWidth = Math.max(...textLines.map(line => {
      ctx.font = `bold ${fontSize}px Arial`;
      return ctx.measureText(line).width;
    }));

    const boxHeight = (textLines.length * lineHeight) + (padding * 2);
    const boxWidth = maxWidth + (padding * 2);

    ctx.fillRect(
      canvas.width - boxWidth - 10,
      canvas.height - boxHeight - 10,
      boxWidth,
      boxHeight
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'right';

    textLines.forEach((line, index) => {
      ctx.fillText(
        line,
        canvas.width - padding - 10,
        canvas.height - boxHeight - 10 + padding + (lineHeight * (index + 1))
      );
    });

    return canvas;
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const watermarkedCanvas = addWatermarkToImage(canvas);

    watermarkedCanvas.toBlob((blob) => {
      if (!blob) return;

      const timestamp = new Date().getTime();
      const file = new File(
        [blob],
        `photo_${timestamp}.jpg`,
        { type: 'image/jpeg' }
      );

      // Always show preview after capture, never auto-upload
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
        setCapturedFile(file);
      };
      reader.readAsDataURL(file);
      closeCamera();
    }, 'image/jpeg', 0.95);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedFile(null);
    openCamera();
  };

  const handleUpload = () => {
    if (capturedFile) {
      const newFiles = [...selectedFiles, capturedFile];

      // Call onUpload immediately - parent will close modal and remount with fresh key
      onUpload(newFiles);

      // State will be cleared when component unmounts
    }
  };

  const handleCancelCapture = () => {
    setCapturedImage(null);
    setCapturedFile(null);

    // Close parent modal if in auto-camera mode
    if (autoOpenCamera && onCancel) {
      onCancel();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {capturedImage && (
        <div className="flex flex-col h-full gap-4">
          <div className="relative bg-black rounded-lg overflow-hidden flex-1 min-h-0">
            <img
              src={capturedImage}
              alt="Captured photo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={handleRetake}
              className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold shadow-lg"
            >
              Retake
            </button>

            <button
              onClick={handleUpload}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-lg"
            >
              Save
            </button>

            <button
              onClick={handleCancelCapture}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isCameraOpen && !capturedImage && (
        <div className="flex flex-col h-full gap-3">
          <div className="relative bg-black rounded-lg overflow-hidden flex-1 min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="absolute top-3 left-3 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-xs">
              <div className="font-semibold">{user?.name || 'User'}</div>
              <div className="text-[10px]">{user?.role || ''} {user?.territory ? `| ${user.territory}` : ''}</div>
              <div className="text-[10px] mt-0.5">
                {new Date().toLocaleString('en-IN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={capturePhoto}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-lg"
            >
              <Camera className="w-5 h-5" />
              Capture
            </button>

            <button
              onClick={() => closeCamera(true)}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(previews.length > 0 || existingMedia.length > 0) && !isCameraOpen && !capturedImage && (
        <div className="grid grid-cols-2 gap-2">
          {existingMedia.map((media, index) => (
            <div key={`existing-${index}`} className="relative">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {media.includes('video') ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-gray-400" />
                  </div>
                ) : (
                  <img
                    src={media}
                    alt={`Media ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          ))}

          {previews.map((preview, index) => (
            <div key={`preview-${index}`} className="relative">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {selectedFiles[index]?.type.startsWith('video/') ? (
                  <video
                    src={preview}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isCameraOpen && !capturedImage && !autoOpenCamera && selectedFiles.length > 0 && (
        <p className="text-sm text-gray-500">
          {selectedFiles.length + existingMedia.length}/{maxFiles} files selected
        </p>
      )}
    </div>
  );
};
