
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useState, useRef, useEffect} from 'react';
import {AspectRatio, StorySegment, Speaker} from '../types';
import {ArrowPathIcon, DownloadIcon, SparklesIcon, FileImageIcon, PlusIcon, ArrowRightIcon, PlayIcon} from './icons';
// @ts-ignore
import gifshot from 'gifshot';

interface VideoResultProps {
  currentSegment: StorySegment;
  timeline: StorySegment[];
  onRetry: () => void;
  onNewVideo: () => void;
  onAddScene: () => void;
  onExtend: () => void;
  canExtend: boolean;
  aspectRatio: AspectRatio;
}

const VideoResult: React.FC<VideoResultProps> = ({
  currentSegment,
  timeline,
  onRetry,
  onNewVideo,
  onAddScene,
  onExtend,
  canExtend,
  aspectRatio,
}) => {
  const isPortrait = aspectRatio === AspectRatio.PORTRAIT;
  const [isConvertingGif, setIsConvertingGif] = useState(false);
  
  // Story Playback State
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [viewingSegment, setViewingSegment] = useState<StorySegment>(currentSegment);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Update viewing segment when currentSegment changes (generation finished)
  useEffect(() => {
    if (!isPlayingStory) {
      setViewingSegment(currentSegment);
    }
  }, [currentSegment, isPlayingStory]);

  // Update viewing segment during playback
  useEffect(() => {
    if (isPlayingStory && storyIndex >= 0 && storyIndex < timeline.length) {
      setViewingSegment(timeline[storyIndex]);
    }
  }, [isPlayingStory, storyIndex, timeline]);

  // Sync Audio with Video & Handle Auto-Play for Story Mode
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (!video || !audio) return;

    // Standard sync handlers
    const handlePlay = () => audio.play().catch(e => console.log("Audio autoplay prevented", e));
    const handlePause = () => audio.pause();
    const handleSeek = () => { audio.currentTime = video.currentTime; };
    const handleVolume = () => { audio.volume = video.muted ? 0 : video.volume; };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeek);
    video.addEventListener('volumechange', handleVolume);

    // If in Story Mode, we need to auto-play the new source
    if (isPlayingStory) {
      // Small timeout to ensure DOM has updated with new src
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Auto-play prevented during story mode:", error);
        });
      }
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeek);
      video.removeEventListener('volumechange', handleVolume);
    };
  }, [viewingSegment.videoUrl, viewingSegment.audioUrl, isPlayingStory]);

  const handleVideoEnded = () => {
    if (isPlayingStory) {
      if (storyIndex < timeline.length - 1) {
        setStoryIndex(prev => prev + 1);
      } else {
        setIsPlayingStory(false);
        setStoryIndex(0);
        // Reset to show the last generated segment when done
        setViewingSegment(currentSegment);
      }
    }
  };

  const togglePlayStory = () => {
    if (isPlayingStory) {
      setIsPlayingStory(false);
      setViewingSegment(currentSegment);
    } else {
      setStoryIndex(0);
      setIsPlayingStory(true);
    }
  };

  const handleDownloadGif = (frames: number) => {
    if (!viewingSegment.videoUrl) return;
    
    setIsConvertingGif(true);
    
    gifshot.createGIF({
      video: [viewingSegment.videoUrl],
      numFrames: frames,
      interval: 0.1, // Sampling interval
      gifWidth: isPortrait ? 360 : 640,
      gifHeight: isPortrait ? 640 : 360,
      sampleInterval: 10,
    }, (obj: any) => {
      if (!obj.error) {
        const link = document.createElement('a');
        link.href = obj.image;
        link.download = `veo-studio-creation-${frames/10}s.gif`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        console.error('GIF generation failed:', obj.error);
        alert('Failed to generate GIF. Try again with a shorter duration.');
      }
      setIsConvertingGif(false);
    });
  };

  const getSpeakerColor = (speaker?: Speaker) => {
    switch(speaker) {
      case Speaker.ELENA: return 'text-purple-400';
      case Speaker.ARUN: return 'text-blue-400';
      case Speaker.NARRATOR: return 'text-amber-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      
      {/* Main Preview Card */}
      <div className="w-full relative flex flex-col items-center gap-6 p-8 bg-gray-800/50 rounded-lg border border-gray-700 shadow-2xl overflow-visible">
        {/* New Story Button moved to top-left corner */}
        <button
          onClick={onNewVideo}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-red-900/40 hover:text-red-200 text-gray-300 text-xs font-semibold rounded-lg transition-all active:scale-95 z-10"
        >
          <PlusIcon className="w-4 h-4 rotate-45" />
          New Story
        </button>
        
        {/* Play Full Story Button - Top Right */}
        {timeline.length > 1 && (
          <button
            onClick={togglePlayStory}
            className={`absolute top-4 right-4 flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all active:scale-95 z-10 shadow-lg ${
              isPlayingStory 
                ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white ring-1 ring-indigo-400/50'
            }`}
          >
            {isPlayingStory ? (
              <>
                <div className="w-2 h-2 bg-white rounded-sm" />
                Stop Story
              </>
            ) : (
              <>
                <PlayIcon className="w-3 h-3 fill-current" />
                Play Full Story ({timeline.length} Scenes)
              </>
            )}
          </button>
        )}

        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-200">
            {isPlayingStory 
              ? `Playing Scene ${storyIndex + 1}/${timeline.length}` 
              : (timeline.length > 1 ? `Scene ${timeline.length} Ready` : 'Scene Ready')
            }
          </h2>
        </div>

        <div 
          className={`relative w-full ${
            isPortrait ? 'max-w-xs aspect-[9/16]' : 'max-w-2xl aspect-video'
          } rounded-lg overflow-hidden bg-black shadow-[0_0_50px_rgba(79,70,229,0.2)] border border-indigo-500/30 transition-all duration-500 group`}
        >
          <video
            ref={videoRef}
            src={viewingSegment.videoUrl}
            controls={!isPlayingStory}
            autoPlay={isPlayingStory}
            onEnded={handleVideoEnded}
            className="w-full h-full object-contain"
          />
          {viewingSegment.audioUrl && (
            <audio ref={audioRef} src={viewingSegment.audioUrl} />
          )}
          
          {/* Subtitles Overlay */}
          {viewingSegment.dialogue && (
            <div className="absolute bottom-12 left-0 right-0 p-4 text-center pointer-events-none">
              <span className={`inline-block px-4 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-lg font-medium shadow-lg ${getSpeakerColor(viewingSegment.speaker)}`}>
                {viewingSegment.speaker && viewingSegment.speaker !== Speaker.NONE && (
                   <span className="font-bold mr-2 uppercase text-xs tracking-wider opacity-75">{viewingSegment.speaker}:</span>
                )}
                {viewingSegment.dialogue}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons - Hide during auto-play to focus on content */}
        {!isPlayingStory && (
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all active:scale-95"
              title="Regenerate with same parameters">
              <ArrowPathIcon className="w-5 h-5" />
              Retry
            </button>

            {/* Add Next Scene Button - Primary Action */}
            <button
              onClick={onAddScene}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-900/40 ring-2 ring-indigo-500/20"
              title="Create the next scene in the story with the same settings">
              <span>Add Next Scene</span>
              <ArrowRightIcon className="w-5 h-5" />
            </button>
            
            <a
              href={viewingSegment.videoUrl}
              download={`veo-scene-${isPlayingStory ? storyIndex + 1 : timeline.length}.mp4`}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-900/20">
              <DownloadIcon className="w-5 h-5" />
              MP4
            </a>

            {/* GIF Download */}
            <div className="relative group">
              <button
                disabled={isConvertingGif}
                className={`flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-all active:scale-95 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-wait`}
              >
                {isConvertingGif ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <FileImageIcon className="w-5 h-5" />
                )}
                {isConvertingGif ? '...' : 'GIF'}
              </button>
              
              {!isConvertingGif && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-visible opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-30
                after:content-[''] after:absolute after:top-full after:left-0 after:w-full after:h-4">
                  <div className="overflow-hidden rounded-xl bg-gray-800">
                    <div className="p-3 text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-700 text-center font-bold">
                      GIF Duration
                    </div>
                    <button 
                      onClick={() => handleDownloadGif(20)} 
                      className="w-full text-left px-4 py-3 text-sm hover:bg-amber-600/50 transition-colors flex justify-between items-center group/item"
                    >
                      <span>2s</span>
                      <span className="text-[10px] text-gray-500 group-hover/item:text-white">4x Speed</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadGif(40)} 
                      className="w-full text-left px-4 py-3 text-sm hover:bg-amber-600/50 transition-colors flex justify-between items-center group/item"
                    >
                      <span>4s</span>
                      <span className="text-[10px] text-gray-500 group-hover/item:text-white">2x Speed</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadGif(80)} 
                      className="w-full text-left px-4 py-3 text-sm hover:bg-amber-600/50 transition-colors flex justify-between items-center group/item"
                    >
                      <span>8s</span>
                      <span className="text-[10px] text-gray-500 group-hover/item:text-white">Normal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {canExtend ? (
              <button
                onClick={onExtend}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold rounded-lg transition-all active:scale-95 border border-gray-600"
                title="Extend this video by 7 seconds">
                <SparklesIcon className="w-5 h-5" />
                Extend
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 px-6 py-3 bg-gray-800/50 text-gray-600 font-semibold rounded-lg cursor-not-allowed opacity-60 border border-gray-800"
                title="1080p/4k videos can't be extended">
                <SparklesIcon className="w-5 h-5" />
                Extend
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timeline View */}
      {timeline.length > 0 && (
         <div className="w-full max-w-4xl p-4 bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-x-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 sticky left-0">Storyboard Timeline</h3>
            <div className="flex gap-4 min-w-min">
              {timeline.map((segment, index) => {
                 const isPlaying = isPlayingStory && storyIndex === index;
                 const isActive = viewingSegment.id === segment.id;
                 
                 return (
                  <div 
                    key={segment.id} 
                    onClick={() => {
                      if (!isPlayingStory) setViewingSegment(segment);
                    }}
                    className={`relative flex-shrink-0 w-48 transition-all rounded-lg overflow-hidden bg-gray-900 cursor-pointer 
                      ${isPlaying ? 'ring-2 ring-red-500 scale-105' : (isActive ? 'ring-2 ring-indigo-500' : 'opacity-60 hover:opacity-100')}`}
                  >
                    <video src={segment.videoUrl} className="w-full h-28 object-cover bg-black pointer-events-none" />
                    <div className="p-2">
                      <div className="flex justify-between items-center mb-1">
                         <span className={`text-[10px] font-bold ${isPlaying ? 'text-red-400' : 'text-gray-400'}`}>Scene {index + 1}</span>
                         {segment.audioUrl && <span className="text-[10px] text-indigo-400">♫ Audio</span>}
                      </div>
                      <p className="text-[10px] text-gray-500 truncate">{segment.prompt}</p>
                      {segment.dialogue && (
                         <p className={`text-[10px] truncate mt-1 ${getSpeakerColor(segment.speaker)}`}>
                           <span className="font-bold">{segment.speaker}:</span> {segment.dialogue}
                         </p>
                      )}
                    </div>
                  </div>
                 );
              })}
            </div>
         </div>
      )}

    </div>
  );
};

export default VideoResult;
