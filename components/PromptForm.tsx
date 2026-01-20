
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  Resolution,
  Speaker,
  VeoModel,
  VideoFile,
} from '../types';
import {
  ArrowRightIcon,
  ChevronDownIcon,
  FilmIcon,
  FramesModeIcon,
  PlusIcon,
  RectangleStackIcon,
  ReferencesModeIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TextModeIcon,
  TvIcon,
  XMarkIcon,
} from './icons';

const aspectRatioDisplayNames: Record<AspectRatio, string> = {
  [AspectRatio.LANDSCAPE]: 'Landscape (16:9)',
  [AspectRatio.PORTRAIT]: 'Portrait (9:16)',
};

const modeIcons: Record<GenerationMode, React.ReactNode> = {
  [GenerationMode.TEXT_TO_VIDEO]: <TextModeIcon className="w-5 h-5" />,
  [GenerationMode.FRAMES_TO_VIDEO]: <FramesModeIcon className="w-5 h-5" />,
  [GenerationMode.REFERENCES_TO_VIDEO]: (
    <ReferencesModeIcon className="w-5 h-5" />
  ),
  [GenerationMode.EXTEND_VIDEO]: <FilmIcon className="w-5 h-5" />,
};

const fileToBase64 = <T extends {file: File; base64: string}>(
  file: File,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (base64) {
        resolve({file, base64} as T);
      } else {
        reject(new Error('Failed to read file as base64.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};
const fileToImageFile = (file: File): Promise<ImageFile> =>
  fileToBase64<ImageFile>(file);
const fileToVideoFile = (file: File): Promise<VideoFile> =>
  fileToBase64<VideoFile>(file);

const extractFrameFromVideo = (videoFile: File): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.autoplay = true;
    video.muted = true;
    video.src = URL.createObjectURL(videoFile);
    
    video.onloadeddata = () => {
       // Seek to the end (minus a small buffer to avoid black frames)
       if (video.duration > 0.5) {
         video.currentTime = video.duration - 0.1; 
       } else {
         video.currentTime = 0;
       }
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Url = canvas.toDataURL('image/jpeg');
      const base64 = base64Url.split(',')[1];
      
      // Convert base64 back to a File object for consistency
      fetch(base64Url)
      .then(res => res.blob())
      .then(blob => {
        const imageFile = new File([blob], "extracted_frame.jpg", { type: "image/jpeg" });
        resolve({ file: imageFile, base64 });
        URL.revokeObjectURL(video.src);
      });
    };
    
    video.onerror = (e) => {
      reject(new Error("Failed to load video for frame extraction"));
    }
  });
};


const CustomSelect: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({label, value, onChange, icon, children, disabled = false}) => (
  <div>
    <label
      className={`text-xs block mb-1.5 font-medium ${
        disabled ? 'text-gray-500' : 'text-gray-400'
      }`}>
      {label}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        {icon}
      </div>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full bg-[#1f1f1f] border border-gray-600 rounded-lg pl-10 pr-8 py-2.5 appearance-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700/50 disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-sm">
        {children}
      </select>
      <ChevronDownIcon
        className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
          disabled ? 'text-gray-600' : 'text-gray-400'
        }`}
      />
    </div>
  </div>
);

const ImageUpload: React.FC<{
  onSelect: (image: ImageFile) => void;
  onRemove?: () => void;
  image?: ImageFile | null;
  label: React.ReactNode;
  className?: string;
  compact?: boolean;
  acceptVideo?: boolean;
}> = ({onSelect, onRemove, image, label, className = "w-28 h-20", compact = false, acceptVideo = false}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (file.type.startsWith('video/')) {
          setIsExtracting(true);
          const extractedImage = await extractFrameFromVideo(file);
          onSelect(extractedImage);
          setIsExtracting(false);
        } else {
          const imageFile = await fileToImageFile(file);
          onSelect(imageFile);
        }
      } catch (error) {
        console.error('Error converting file:', error);
        setIsExtracting(false);
      }
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  if (image) {
    return (
      <div className={`relative group ${className}`}>
        <img
          src={URL.createObjectURL(image.file)}
          alt="preview"
          className="w-full h-full object-cover rounded-lg shadow-inner ring-1 ring-gray-700"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100"
          aria-label="Remove image">
          <XMarkIcon className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={isExtracting}
      className={`${className} bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors group relative overflow-hidden`}>
      {isExtracting ? (
        <div className="flex flex-col items-center">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-1"></div>
          <span className="text-[9px]">Extracting...</span>
        </div>
      ) : (
        <>
          <PlusIcon className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
          {!compact && <span className="text-[10px] text-center px-1 leading-tight">{label}</span>}
        </>
      )}
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept={acceptVideo ? "image/*,video/*" : "image/*"}
        className="hidden"
      />
    </button>
  );
};

const VideoUpload: React.FC<{
  onSelect: (video: VideoFile) => void;
  onRemove?: () => void;
  video?: VideoFile | null;
  label: React.ReactNode;
}> = ({onSelect, onRemove, video, label}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const videoFile = await fileToVideoFile(file);
        onSelect(videoFile);
      } catch (error) {
        console.error('Error converting file:', error);
      }
    }
  };

  if (video) {
    return (
      <div className="relative w-48 h-28 group">
        <video
          src={URL.createObjectURL(video.file)}
          muted
          loop
          className="w-full h-full object-cover rounded-lg shadow-inner"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove video">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="w-48 h-28 bg-gray-700/50 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors text-center">
      <PlusIcon className="w-6 h-6" />
      <span className="text-xs mt-1 px-2">{label}</span>
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept="video/*"
        className="hidden"
      />
    </button>
  );
};

interface PromptFormProps {
  onGenerate: (params: GenerateVideoParams) => void;
  initialValues?: GenerateVideoParams | null;
}

const PromptForm: React.FC<PromptFormProps> = ({
  onGenerate,
  initialValues,
}) => {
  const [prompt, setPrompt] = useState(initialValues?.prompt ?? '');
  const [model, setModel] = useState<VeoModel>(
    initialValues?.model ?? VeoModel.VEO_FAST,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initialValues?.aspectRatio ?? AspectRatio.LANDSCAPE,
  );
  const [resolution, setResolution] = useState<Resolution>(
    initialValues?.resolution ?? Resolution.P720,
  );
  const [generationMode, setGenerationMode] = useState<GenerationMode>(
    initialValues?.mode ?? GenerationMode.TEXT_TO_VIDEO,
  );
  const [startFrame, setStartFrame] = useState<ImageFile | null>(
    initialValues?.startFrame ?? null,
  );
  const [endFrame, setEndFrame] = useState<ImageFile | null>(
    initialValues?.endFrame ?? null,
  );
  const [referenceImages, setReferenceImages] = useState<ImageFile[]>(
    initialValues?.referenceImages ?? [],
  );
  const [styleImage, setStyleImage] = useState<ImageFile | null>(
    initialValues?.styleImage ?? null,
  );
  const [inputVideo, setInputVideo] = useState<VideoFile | null>(
    initialValues?.inputVideo ?? null,
  );
  const [inputVideoObject, setInputVideoObject] = useState<Video | null>(
    initialValues?.inputVideoObject ?? null,
  );
  const [isLooping, setIsLooping] = useState(initialValues?.isLooping ?? false);
  
  // Dialogue state
  const [dialogue, setDialogue] = useState(initialValues?.dialogue ?? '');
  const [speaker, setSpeaker] = useState<Speaker>(initialValues?.speaker ?? Speaker.NONE);
  const [showDialogueInput, setShowDialogueInput] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogueRef = useRef<HTMLTextAreaElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialValues) {
      setPrompt(initialValues.prompt ?? '');
      setModel(initialValues.model ?? VeoModel.VEO_FAST);
      setAspectRatio(initialValues.aspectRatio ?? AspectRatio.LANDSCAPE);
      setResolution(initialValues.resolution ?? Resolution.P720);
      setGenerationMode(initialValues.mode ?? GenerationMode.TEXT_TO_VIDEO);
      setStartFrame(initialValues.startFrame ?? null);
      setEndFrame(initialValues.endFrame ?? null);
      setReferenceImages(initialValues.referenceImages ?? []);
      setStyleImage(initialValues.styleImage ?? null);
      setInputVideo(initialValues.inputVideo ?? null);
      setInputVideoObject(initialValues.inputVideoObject ?? null);
      setIsLooping(initialValues.isLooping ?? false);
      setDialogue(initialValues.dialogue ?? '');
      setSpeaker(initialValues.speaker ?? Speaker.NONE);
      if (initialValues.dialogue || initialValues.speaker !== Speaker.NONE) {
        setShowDialogueInput(true);
      }
    }
  }, [initialValues]);

  useEffect(() => {
    // Rule: Extension strictly only works in 720p
    if (generationMode === GenerationMode.EXTEND_VIDEO) {
      setResolution(Resolution.P720);
    }
    // Rule: Multiple reference images mode strictly requires 'veo-3.1-generate-preview' model, '16:9' aspect ratio, and '720p' resolution.
    if (generationMode === GenerationMode.REFERENCES_TO_VIDEO) {
      setModel(VeoModel.VEO);
      setAspectRatio(AspectRatio.LANDSCAPE);
      setResolution(Resolution.P720);
    }
  }, [generationMode]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, 100)}px`;
    }
  }, [prompt]);

  useEffect(() => {
    const textarea = dialogueRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [dialogue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modeSelectorRef.current &&
        !modeSelectorRef.current.contains(event.target as Node)
      ) {
        setIsModeSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onGenerate({
        prompt,
        model,
        aspectRatio,
        resolution,
        mode: generationMode,
        startFrame,
        endFrame,
        referenceImages,
        styleImage,
        inputVideo,
        inputVideoObject,
        isLooping,
        dialogue: showDialogueInput ? dialogue : undefined,
        speaker: showDialogueInput ? speaker : Speaker.NONE,
      });
    },
    [
      prompt,
      model,
      aspectRatio,
      resolution,
      generationMode,
      startFrame,
      endFrame,
      referenceImages,
      styleImage,
      inputVideo,
      inputVideoObject,
      onGenerate,
      isLooping,
      dialogue,
      speaker,
      showDialogueInput,
    ],
  );

  const handleSelectMode = (mode: GenerationMode) => {
    setGenerationMode(mode);
    setIsModeSelectorOpen(false);
    // Clearing current assets to match the selected mode's requirements
    setStartFrame(null);
    setEndFrame(null);
    setReferenceImages([]);
    setStyleImage(null);
    setInputVideo(null);
    setInputVideoObject(null);
    setIsLooping(false);
  };

  const promptPlaceholder = {
    [GenerationMode.TEXT_TO_VIDEO]: 'Describe the scene visually...',
    [GenerationMode.FRAMES_TO_VIDEO]:
      'Describe motion between start and end frames (optional)...',
    [GenerationMode.REFERENCES_TO_VIDEO]:
      'Describe what happens in this scene (Context & Action)...',
    [GenerationMode.EXTEND_VIDEO]: 'Describe what happens next (optional)...',
  }[generationMode];

  const selectableModes = [
    GenerationMode.TEXT_TO_VIDEO,
    GenerationMode.FRAMES_TO_VIDEO,
    GenerationMode.REFERENCES_TO_VIDEO,
  ];

  const totalReferences = referenceImages.length + (styleImage ? 1 : 0);

  const renderMediaUploads = () => {
    if (generationMode === GenerationMode.FRAMES_TO_VIDEO) {
      return (
        <div className="mb-3 p-4 bg-[#2c2c2e] rounded-xl border border-gray-700 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center justify-center gap-4">
            <ImageUpload
              label="Start Frame"
              image={startFrame}
              onSelect={setStartFrame}
              onRemove={() => {
                setStartFrame(null);
                setIsLooping(false);
              }}
              acceptVideo={true} // Allow video to extract start frame
            />
            {!isLooping && (
              <ImageUpload
                label="End Frame"
                image={endFrame}
                onSelect={setEndFrame}
                onRemove={() => setEndFrame(null)}
              />
            )}
          </div>
          <p className="text-[10px] text-gray-500 italic">
            Images-to-video requires at least a start frame. You can also upload a video to use its last frame as start.
          </p>
          {startFrame && !endFrame && (
            <div className="mt-1 flex items-center">
              <input
                id="loop-video-checkbox"
                type="checkbox"
                checked={isLooping}
                onChange={(e) => setIsLooping(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-800 cursor-pointer"
              />
              <label
                htmlFor="loop-video-checkbox"
                className="ml-2 text-sm font-medium text-gray-300 cursor-pointer">
                Create a looping video
              </label>
            </div>
          )}
        </div>
      );
    }
    if (generationMode === GenerationMode.REFERENCES_TO_VIDEO) {
      return (
        <div className="mb-4 p-4 bg-[#1a1a1a] rounded-xl border border-gray-700 flex flex-col gap-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block text-center">
              Character, Style, or Previous Video References
            </label>
            <div className="flex items-center justify-center gap-3">
              {/* Always show 3 slots for clarity */}
              {[0, 1, 2].map((i) => (
                 <div key={i}>
                    {referenceImages[i] ? (
                       <ImageUpload
                        image={referenceImages[i]}
                        label=""
                        onSelect={() => {}}
                        onRemove={() =>
                          setReferenceImages((imgs) => imgs.filter((_, idx) => idx !== i))
                        }
                        className="w-24 h-24"
                      />
                    ) : (
                      <ImageUpload
                        label={i === 0 ? "Video / Ref 1" : `Ref ${i + 1}`}
                        onSelect={(img) => setReferenceImages((imgs) => [...imgs, img])}
                        className="w-24 h-24"
                        compact={false}
                        acceptVideo={true} // Allow video upload here to extract frame
                      />
                    )}
                 </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 text-center">
              Upload images or <strong>videos</strong> (auto-extracts last frame) to maintain character consistency.
            </p>
        </div>
      );
    }
    if (generationMode === GenerationMode.EXTEND_VIDEO) {
      return (
        <div className="mb-3 p-4 bg-[#2c2c2e] rounded-xl border border-gray-700 flex items-center justify-center gap-4">
          <VideoUpload
            label={
              <>
                Input Video
                <br />
                (Previous generation)
              </>
            }
            video={inputVideo}
            onSelect={setInputVideo}
            onRemove={() => {
              setInputVideo(null);
              setInputVideoObject(null);
            }}
          />
        </div>
      );
    }
    return null;
  };

  const isExtendMode = generationMode === GenerationMode.EXTEND_VIDEO;
  const isReferenceMode = generationMode === GenerationMode.REFERENCES_TO_VIDEO;

  let isSubmitDisabled = false;
  let tooltipText = '';

  switch (generationMode) {
    case GenerationMode.TEXT_TO_VIDEO:
      isSubmitDisabled = !prompt.trim();
      if (isSubmitDisabled) {
        tooltipText = 'Please enter a visual description.';
      }
      break;
    case GenerationMode.FRAMES_TO_VIDEO:
      isSubmitDisabled = !startFrame;
      if (isSubmitDisabled) {
        tooltipText = 'A start frame is required.';
      }
      break;
    case GenerationMode.REFERENCES_TO_VIDEO:
      const hasNoPrompt = !prompt.trim();
      const hasNoAssets = referenceImages.length === 0;
      isSubmitDisabled = hasNoPrompt || hasNoAssets;
      if (hasNoPrompt && hasNoAssets) {
        tooltipText = 'Please enter a prompt and add at least one asset.';
      } else if (hasNoPrompt) {
        tooltipText = 'Please enter a prompt.';
      } else if (hasNoAssets) {
        tooltipText = 'At least one reference asset is required.';
      }
      break;
    case GenerationMode.EXTEND_VIDEO:
      isSubmitDisabled = !inputVideoObject;
      if (isSubmitDisabled) {
        tooltipText =
          'An input video from a previous generation is required to extend.';
      }
      break;
  }

  return (
    <div className="relative w-full">
      {isSettingsOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-3 p-4 bg-[#2c2c2e] rounded-xl border border-gray-700 shadow-2xl z-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <CustomSelect
                label="Model"
                value={model}
                onChange={(e) => setModel(e.target.value as VeoModel)}
                icon={<SparklesIcon className="w-5 h-5 text-gray-400" />}
                disabled={isReferenceMode}>
                {Object.values(VeoModel).map((modelValue) => (
                  <option key={modelValue} value={modelValue}>
                    {modelValue === VeoModel.VEO ? 'High Quality (Veo 3.1)' : 'Fast (Veo 3.1)'}
                  </option>
                ))}
              </CustomSelect>
              {isReferenceMode && (
                <p className="text-[10px] text-indigo-400 mt-1 uppercase tracking-tighter">
                  R2V is locked to High Quality
                </p>
              )}
            </div>
            <div className="flex flex-col">
              <CustomSelect
                label="Aspect Ratio"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                icon={<RectangleStackIcon className="w-5 h-5 text-gray-400" />}
                disabled={isReferenceMode}>
                {Object.entries(aspectRatioDisplayNames).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </CustomSelect>
              {isReferenceMode && (
                <p className="text-[10px] text-indigo-400 mt-1 uppercase tracking-tighter">
                  R2V is locked to 16:9
                </p>
              )}
            </div>
            <div className="flex flex-col">
              <CustomSelect
                label="Resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution)}
                icon={<TvIcon className="w-5 h-5 text-gray-400" />}
                disabled={isExtendMode || isReferenceMode}>
                <option value={Resolution.P720}>720p</option>
                <option value={Resolution.P1080}>1080p</option>
                <option value={Resolution.P4K}>4K</option>
              </CustomSelect>
              {isExtendMode ? (
                <p className="text-[10px] text-indigo-400 mt-1 uppercase tracking-tighter">
                  Extension is locked to 720p
                </p>
              ) : isReferenceMode ? (
                <p className="text-[10px] text-indigo-400 mt-1 uppercase tracking-tighter">
                  R2V is locked to 720p
                </p>
              ) : resolution !== Resolution.P720 ? (
                <p className="text-[10px] text-amber-400 mt-1 uppercase tracking-tighter">
                  1080p/4k videos can't be extended
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="w-full">
        {renderMediaUploads()}
        
        {/* Main Input Area */}
        <div className="bg-[#1f1f1f] border border-gray-600 rounded-2xl shadow-lg focus-within:ring-2 focus-within:ring-indigo-500 flex flex-col overflow-hidden">
          
          {/* Top Bar: Mode & Settings */}
          <div className="flex items-center gap-2 p-2 border-b border-gray-700/50">
            <div className="relative" ref={modeSelectorRef}>
              <button
                type="button"
                onClick={() => setIsModeSelectorOpen((prev) => !prev)}
                className="flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
              >
                {modeIcons[generationMode]}
                <span className="font-medium text-xs whitespace-nowrap">
                  {generationMode}
                </span>
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              </button>
              {isModeSelectorOpen && (
                <div className="absolute top-full left-0 mt-1 w-60 bg-[#2c2c2e] border border-gray-600 rounded-lg shadow-xl overflow-hidden z-30">
                  {selectableModes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSelectMode(mode)}
                      className={`w-full text-left flex items-center gap-3 p-3 hover:bg-indigo-600/50 ${generationMode === mode ? 'bg-indigo-600/30 text-white' : 'text-gray-300'}`}>
                      {modeIcons[mode]}
                      <span className="text-sm">{mode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="h-4 w-px bg-gray-700 mx-1"></div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className={`p-1.5 rounded-lg hover:bg-gray-700 ${isSettingsOpen ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
              title="Video Settings">
              <SlidersHorizontalIcon className="w-4 h-4" />
            </button>

            <div className="flex-grow"></div>

            <button
               type="button"
               onClick={() => setShowDialogueInput(prev => !prev)}
               className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showDialogueInput ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/50' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              {showDialogueInput ? 'Hide Dialogue' : '+ Dialogue & Audio'}
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4">
             {/* Main Scene Description Input */}
             <div className="space-y-1">
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Scene Description (Context & Action)
                 </label>
                 <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={promptPlaceholder}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-3 text-base text-gray-200 placeholder-gray-500 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-none transition-all"
                    rows={5}
                  />
             </div>

            {showDialogueInput && (
              <div className="flex gap-3 items-start animate-in slide-in-from-top-2 fade-in duration-200 pt-2 border-t border-gray-700/50">
                 <div className="w-full space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                       Dialogue & Audio
                    </label>
                    <div className="flex gap-3">
                        <div className="w-1/3 min-w-[120px]">
                           <select
                              value={speaker}
                              onChange={(e) => setSpeaker(e.target.value as Speaker)}
                              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                              <option value={Speaker.NONE}>Select Speaker...</option>
                              <option value={Speaker.ELENA}>Elena (Scientist)</option>
                              <option value={Speaker.ARUN}>Arun (Scientist)</option>
                              <option value={Speaker.NARRATOR}>Narrator</option>
                           </select>
                        </div>
                        <textarea
                          ref={dialogueRef}
                          value={dialogue}
                          onChange={(e) => setDialogue(e.target.value)}
                          placeholder="Type dialogue to generate speech..."
                          className="flex-grow bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-indigo-200 focus:outline-none focus:border-indigo-500 resize-none max-h-32"
                          rows={2}
                        />
                    </div>
                 </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-700/50 flex justify-end bg-gray-800/20">
            <div className="relative group">
              <button
                type="submit"
                className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all font-bold text-sm text-white shadow-lg shadow-indigo-900/20"
                aria-label="Generate video"
                disabled={isSubmitDisabled}>
                Generate Segment
                <ArrowRightIcon className="w-4 h-4" />
              </button>
              {isSubmitDisabled && tooltipText && (
                <div
                  role="tooltip"
                  className="absolute bottom-full right-0 mb-2 w-max max-w-xs px-3 py-1.5 bg-gray-900 border border-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {tooltipText}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-500 text-center mt-3 px-4 uppercase tracking-tighter">
          T2V, I2V, and R2V support all resolutions. Extensions are limited to 720p.
        </p>
      </form>
    </div>
  );
};

export default PromptForm;
