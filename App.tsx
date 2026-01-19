
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useState} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import {CurvedArrowDownIcon} from './components/icons';
import LoadingIndicator from './components/LoadingIndicator';
import PromptForm from './components/PromptForm';
import VideoResult from './components/VideoResult';
import {generateVideo, generateSpeech} from './services/geminiService';
import {
  AppState,
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  Resolution,
  Speaker,
  StorySegment,
  VideoFile,
} from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Timeline State
  const [timeline, setTimeline] = useState<StorySegment[]>([]);
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);

  const [lastConfig, setLastConfig] = useState<GenerateVideoParams | null>(
    null,
  );
  const [lastVideoObject, setLastVideoObject] = useState<Video | null>(null);
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  const [initialFormValues, setInitialFormValues] =
    useState<GenerateVideoParams | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        try {
          if (!(await window.aistudio.hasSelectedApiKey())) {
            setShowApiKeyDialog(true);
          }
        } catch (error) {
          console.warn(
            'aistudio.hasSelectedApiKey check failed, assuming no key selected.',
            error,
          );
          setShowApiKeyDialog(true);
        }
      }
    };
    checkApiKey();
  }, []);

  const showStatusError = (message: string) => {
    setErrorMessage(message);
    setAppState(AppState.ERROR);
  };

  const handleGenerate = useCallback(async (params: GenerateVideoParams) => {
    if (window.aistudio) {
      try {
        if (!(await window.aistudio.hasSelectedApiKey())) {
          setShowApiKeyDialog(true);
          return;
        }
      } catch (error) {
        console.warn(
          'aistudio.hasSelectedApiKey check failed, assuming no key selected.',
          error,
        );
        setShowApiKeyDialog(true);
        return;
      }
    }

    setAppState(AppState.LOADING);
    setErrorMessage(null);
    setLastConfig(params);
    setInitialFormValues(null);

    try {
      // Parallel execution if dialogue exists
      const videoPromise = generateVideo(params);
      const speechPromise = (params.dialogue && params.speaker && params.speaker !== Speaker.NONE) 
        ? generateSpeech(params.dialogue, params.speaker)
        : Promise.resolve(null);

      const [videoResult, speechResult] = await Promise.all([videoPromise, speechPromise]);
      const {objectUrl, blob, video} = videoResult;

      const newSegment: StorySegment = {
        id: Date.now().toString(),
        videoUrl: objectUrl,
        audioUrl: speechResult?.audioUrl ?? null,
        prompt: params.prompt,
        dialogue: params.dialogue,
        speaker: params.speaker
      };

      setTimeline(prev => [...prev, newSegment]);
      setCurrentSegmentId(newSegment.id);

      setLastVideoBlob(blob);
      setLastVideoObject(video);
      setAppState(AppState.SUCCESS);
    } catch (error) {
      console.error('Generation failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';

      let userFriendlyMessage = `Generation failed: ${errorMessage}`;
      let shouldOpenDialog = false;

      if (typeof errorMessage === 'string') {
        if (errorMessage.includes('Requested entity was not found.')) {
          userFriendlyMessage =
            'Model not found. This can be caused by an invalid API key or permission issues. Please check your API key.';
          shouldOpenDialog = true;
        } else if (
          errorMessage.includes('API_KEY_INVALID') ||
          errorMessage.includes('API key not valid') ||
          errorMessage.toLowerCase().includes('permission denied') ||
          errorMessage.includes('403')
        ) {
          userFriendlyMessage =
            'Your API key is invalid or lacks permissions. Please select a valid, billing-enabled API key.';
          shouldOpenDialog = true;
        }
      }

      setErrorMessage(userFriendlyMessage);
      setAppState(AppState.ERROR);

      if (shouldOpenDialog) {
        setShowApiKeyDialog(true);
      }
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastConfig) {
      handleGenerate(lastConfig);
    }
  }, [lastConfig, handleGenerate]);

  const handleApiKeyDialogContinue = async () => {
    setShowApiKeyDialog(false);
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
    }
    if (appState === AppState.ERROR && lastConfig) {
      handleRetry();
    }
  };

  const handleNewVideo = useCallback(() => {
    setAppState(AppState.IDLE);
    setErrorMessage(null);
    setLastConfig(null);
    setLastVideoObject(null);
    setLastVideoBlob(null);
    setInitialFormValues(null);
    // Clear Timeline
    setTimeline([]);
    setCurrentSegmentId(null);
  }, []);

  const handleAddScene = useCallback(() => {
    if (lastConfig) {
      // Preserve settings (reference images, model, aspect ratio) but clear content (prompt, dialogue)
      const nextParams: GenerateVideoParams = {
        ...lastConfig,
        prompt: '',
        dialogue: '',
        // If mode was EXTEND, revert to T2V for the next scene unless the user explicitly wants to start with something else.
        // However, if they were using References, we keep Reference mode to maintain character consistency.
        mode: lastConfig.mode === GenerationMode.EXTEND_VIDEO ? GenerationMode.TEXT_TO_VIDEO : lastConfig.mode,
        // Clear frame inputs as they are specific to the previous shot
        startFrame: null,
        endFrame: null,
        inputVideo: null,
        inputVideoObject: null,
        // Preserve reference images and style image
        referenceImages: lastConfig.referenceImages,
        styleImage: lastConfig.styleImage,
        isLooping: false,
      };

      setInitialFormValues(nextParams);
      setAppState(AppState.IDLE);
      setErrorMessage(null);
    } else {
      handleNewVideo();
    }
  }, [lastConfig, handleNewVideo]);

  const handleTryAgainFromError = useCallback(() => {
    if (lastConfig) {
      setInitialFormValues(lastConfig);
      setAppState(AppState.IDLE);
      setErrorMessage(null);
    } else {
      handleNewVideo();
    }
  }, [lastConfig, handleNewVideo]);

  const handleExtend = useCallback(async () => {
    if (lastConfig && lastVideoBlob && lastVideoObject) {
      try {
        const file = new File([lastVideoBlob], 'last_video.mp4', {
          type: lastVideoBlob.type,
        });
        const videoFile: VideoFile = {file, base64: ''};

        setInitialFormValues({
          ...lastConfig,
          mode: GenerationMode.EXTEND_VIDEO,
          prompt: '', 
          inputVideo: videoFile, 
          inputVideoObject: lastVideoObject, 
          resolution: Resolution.P720, 
          startFrame: null,
          endFrame: null,
          referenceImages: [],
          styleImage: null,
          isLooping: false,
          dialogue: '',
          speaker: Speaker.NONE,
        });

        setAppState(AppState.IDLE);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to process video for extension:', error);
        const message =
          error instanceof Error ? error.message : 'An unknown error occurred.';
        showStatusError(`Failed to prepare video for extension: ${message}`);
      }
    }
  }, [lastConfig, lastVideoBlob, lastVideoObject]);

  const renderError = (message: string) => (
    <div className="text-center bg-red-900/20 border border-red-500 p-8 rounded-lg">
      <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
      <p className="text-red-300">{message}</p>
      <button
        onClick={handleTryAgainFromError}
        className="mt-6 px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
        Try Again
      </button>
    </div>
  );

  const canExtend = lastConfig?.resolution === Resolution.P720;
  
  const currentSegment = timeline.find(s => s.id === currentSegmentId);

  return (
    <div className="h-screen bg-black text-gray-200 flex flex-col font-sans overflow-hidden">
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />
      )}
      <header className="py-6 flex items-center justify-center px-8 relative z-10 bg-gradient-to-b from-black to-transparent">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-wide text-center bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          Veo Studio
        </h1>
      </header>
      <main className="w-full max-w-4xl mx-auto flex-grow flex flex-col p-4 overflow-y-auto custom-scrollbar">
        {appState === AppState.IDLE ? (
          <>
            <div className="flex-grow flex items-center justify-center min-h-[300px]">
              <div className="relative text-center">
                 {timeline.length > 0 ? (
                   <div className="mb-8">
                     <h2 className="text-2xl text-gray-300 mb-2">Continue your story</h2>
                     <p className="text-gray-500">{timeline.length} scene{timeline.length !== 1 ? 's' : ''} created so far.</p>
                   </div>
                 ) : (
                    <>
                      <h2 className="text-3xl text-gray-600">
                        Type in the prompt box to start
                      </h2>
                      <CurvedArrowDownIcon className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-24 h-24 text-gray-700 opacity-60" />
                    </>
                 )}
              </div>
            </div>
            
            {/* Timeline Preview in IDLE state if segments exist */}
            {timeline.length > 0 && (
               <div className="flex gap-2 overflow-x-auto pb-4 px-2 mb-4 opacity-50 hover:opacity-100 transition-opacity">
                  {timeline.map((segment, index) => (
                    <div key={segment.id} className="w-32 flex-shrink-0">
                       <div className="aspect-video bg-gray-800 rounded overflow-hidden relative">
                          <video src={segment.videoUrl} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] px-1 py-0.5 text-center text-white truncate">
                             {index + 1}. {segment.speaker !== Speaker.NONE ? segment.speaker : 'Scene'}
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            )}

            <div className="pb-4">
              <PromptForm
                onGenerate={handleGenerate}
                initialValues={initialFormValues}
              />
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            {appState === AppState.LOADING && <LoadingIndicator />}
            {appState === AppState.SUCCESS && currentSegment && (
              <VideoResult
                currentSegment={currentSegment}
                timeline={timeline}
                onRetry={handleRetry}
                onNewVideo={handleNewVideo}
                onAddScene={handleAddScene}
                onExtend={handleExtend}
                canExtend={canExtend}
                aspectRatio={lastConfig?.aspectRatio || AspectRatio.LANDSCAPE}
              />
            )}
            {appState === AppState.SUCCESS &&
              !currentSegment &&
              renderError(
                'Video generated, but data is missing. Please try again.',
              )}
            {appState === AppState.ERROR &&
              errorMessage &&
              renderError(errorMessage)}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
