"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, type PanInfo, useMotionValue, useTransform } from "motion/react";
import { Flame } from "lucide-react";

export type UrgentCarouselPost = {
    id: string;
    title: string;
    description: string;
    metaLine?: string;
};

export type UrgentPostsCarouselProps = {
    posts: UrgentCarouselPost[];
    baseWidth?: number;
    autoplay?: boolean;
    autoplayDelay?: number;
    pauseOnHover?: boolean;
    loop?: boolean;
    onSelectPost?: (id: string) => void;
};

const DRAG_BUFFER = 0;
const VELOCITY_THRESHOLD = 500;
const GAP = 12;
const SPRING_OPTIONS = { type: "spring" as const, stiffness: 300, damping: 30 };

interface SlideProps {
    post: UrgentCarouselPost;
    index: number;
    itemWidth: number;
    trackItemOffset: number;
    x: ReturnType<typeof useMotionValue<number>>;
    transition: typeof SPRING_OPTIONS | { duration: number };
    onSelectPost?: (id: string) => void;
}

function UrgentSlide({ post, index, itemWidth, trackItemOffset, x, transition, onSelectPost }: SlideProps) {
    const range = [-(index + 1) * trackItemOffset, -index * trackItemOffset, -(index - 1) * trackItemOffset];
    const outputRange = [85, 0, -85];
    const rotateY = useTransform(x, range, outputRange, { clamp: false });

    return (
        <motion.div
            className="flex shrink-0 flex-col overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/95 to-white shadow-sm"
            style={{
                width: itemWidth,
                minHeight: 132,
                rotateY,
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
            }}
            transition={transition}
        >
            <div className="flex items-center gap-2 border-b border-amber-100/80 bg-amber-100/40 px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                    <Flame size={18} strokeWidth={2.25} aria-hidden />
                </span>
                <div className="min-w-0 text-xs font-bold uppercase tracking-wide text-amber-900/90">Urgent</div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 px-3 py-2.5">
                <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{post.title}</div>
                <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{post.description}</p>
                {post.metaLine ? <p className="text-[11px] text-amber-800/90">{post.metaLine}</p> : null}
                {onSelectPost ? (
                    <button
                        type="button"
                        onClick={(ev) => {
                            ev.stopPropagation();
                            onSelectPost(post.id);
                        }}
                        className="mt-1 w-full rounded-lg bg-amber-600 py-1.5 text-center text-xs font-semibold text-white transition hover:bg-amber-700"
                    >
                        View in feed
                    </button>
                ) : null}
            </div>
        </motion.div>
    );
}

export default function UrgentPostsCarousel({
    posts,
    baseWidth = 260,
    autoplay = true,
    autoplayDelay = 3800,
    pauseOnHover = true,
    loop = true,
    onSelectPost,
}: UrgentPostsCarouselProps) {
    const containerPadding = 12;
    const itemWidth = Math.max(180, baseWidth - containerPadding * 2);
    const trackItemOffset = itemWidth + GAP;

    const useLoop = loop && posts.length > 1;

    const itemsForRender = useMemo(() => {
        if (posts.length === 0) return [];
        if (!useLoop) return posts;
        const last = posts[posts.length - 1];
        const first = posts[0];
        return [last, ...posts, first];
    }, [posts, useLoop]);

    const [position, setPosition] = useState<number>(useLoop ? 1 : 0);
    const x = useMotionValue(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isJumping, setIsJumping] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const positionRef = useRef(position);
    const isAnimatingRef = useRef(false);

    const containerRef = useRef<HTMLDivElement>(null);

    positionRef.current = position;

    useEffect(() => {
        if (!pauseOnHover || !containerRef.current) return;
        const container = containerRef.current;
        const onEnter = () => setIsHovered(true);
        const onLeave = () => setIsHovered(false);
        container.addEventListener("mouseenter", onEnter);
        container.addEventListener("mouseleave", onLeave);
        return () => {
            container.removeEventListener("mouseenter", onEnter);
            container.removeEventListener("mouseleave", onLeave);
        };
    }, [pauseOnHover]);

    const jumpToFirstRealSlide = useCallback(() => {
        setIsJumping(true);
        const target = 1;
        setPosition(target);
        x.set(-target * trackItemOffset);
        requestAnimationFrame(() => {
            setIsJumping(false);
            setIsAnimating(false);
            isAnimatingRef.current = false;
        });
    }, [trackItemOffset, x]);

    useEffect(() => {
        if (!autoplay || itemsForRender.length <= 1) return undefined;
        if (pauseOnHover && isHovered) return undefined;

        const lastIdx = itemsForRender.length - 1;

        const timer = setInterval(() => {
            if (isAnimatingRef.current) return;

            const prev = positionRef.current;

            if (useLoop) {
                if (prev === lastIdx) {
                    jumpToFirstRealSlide();
                    return;
                }
                setPosition(Math.min(prev + 1, lastIdx));
                return;
            }

            setPosition(Math.min(prev + 1, lastIdx));
        }, autoplayDelay);

        return () => clearInterval(timer);
    }, [
        autoplay,
        autoplayDelay,
        isHovered,
        jumpToFirstRealSlide,
        pauseOnHover,
        itemsForRender.length,
        useLoop,
    ]);

    useEffect(() => {
        const startingPosition = useLoop ? 1 : 0;
        setPosition(startingPosition);
        x.set(-startingPosition * trackItemOffset);
    }, [posts.length, useLoop, trackItemOffset, x]);

    useEffect(() => {
        if (useLoop || position <= itemsForRender.length - 1) return;
        setPosition(Math.max(0, itemsForRender.length - 1));
    }, [itemsForRender.length, useLoop, position]);

    const effectiveTransition = isJumping ? { duration: 0 } : SPRING_OPTIONS;

    const handleAnimationStart = () => {
        setIsAnimating(true);
        isAnimatingRef.current = true;
    };

    const handleAnimationComplete = () => {
        if (!useLoop || itemsForRender.length <= 1) {
            setIsAnimating(false);
            isAnimatingRef.current = false;
            return;
        }
        const lastCloneIndex = itemsForRender.length - 1;

        if (position === lastCloneIndex) {
            jumpToFirstRealSlide();
            return;
        }

        if (position === 0) {
            setIsJumping(true);
            const target = posts.length;
            setPosition(target);
            x.set(-target * trackItemOffset);
            requestAnimationFrame(() => {
                setIsJumping(false);
                setIsAnimating(false);
                isAnimatingRef.current = false;
            });
            return;
        }

        setIsAnimating(false);
        isAnimatingRef.current = false;
    };

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const { offset, velocity } = info;
        const direction =
            offset.x < -DRAG_BUFFER || velocity.x < -VELOCITY_THRESHOLD
                ? 1
                : offset.x > DRAG_BUFFER || velocity.x > VELOCITY_THRESHOLD
                  ? -1
                  : 0;

        if (direction === 0) return;

        setPosition((prev) => {
            const next = prev + direction;
            const max = itemsForRender.length - 1;
            return Math.max(0, Math.min(next, max));
        });
    };

    const dragProps = useLoop
        ? {}
        : {
              dragConstraints: {
                  left: -trackItemOffset * Math.max(itemsForRender.length - 1, 0),
                  right: 0,
              },
          };

    const activeIndex =
        posts.length === 0
            ? 0
            : useLoop
              ? (position - 1 + posts.length) % posts.length
              : Math.min(position, posts.length - 1);

    if (posts.length === 0) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full max-w-full overflow-hidden rounded-xl"
            style={{ width: "100%", maxWidth: baseWidth }}
        >
            <motion.div
                className="flex cursor-grab touch-pan-y active:cursor-grabbing"
                drag={isAnimating ? false : "x"}
                dragElastic={0.12}
                {...dragProps}
                style={{
                    gap: GAP,
                    perspective: 960,
                    perspectiveOrigin: `${position * trackItemOffset + itemWidth / 2}px 50%`,
                    width: "max-content",
                    x,
                }}
                onDragEnd={handleDragEnd}
                animate={{ x: -(position * trackItemOffset) }}
                transition={effectiveTransition}
                onAnimationStart={handleAnimationStart}
                onAnimationComplete={handleAnimationComplete}
            >
                {itemsForRender.map((post, index) => (
                    <UrgentSlide
                        key={`${post.id}-${index}`}
                        post={post}
                        index={index}
                        itemWidth={itemWidth}
                        trackItemOffset={trackItemOffset}
                        x={x}
                        transition={effectiveTransition}
                        onSelectPost={onSelectPost}
                    />
                ))}
            </motion.div>

            <div className="mt-3 flex justify-center pb-0.5">
                <div className="flex items-center gap-1.5">
                    {posts.map((_, index) => (
                        <motion.button
                            type="button"
                            key={posts[index]!.id}
                            aria-label={`Urgent post ${index + 1}`}
                            className={`h-1.5 rounded-full transition-colors ${
                                activeIndex === index ? "w-4 bg-amber-600" : "w-1.5 bg-amber-300/80"
                            }`}
                            animate={{ scale: activeIndex === index ? 1.15 : 1 }}
                            onClick={() => setPosition(useLoop ? index + 1 : index)}
                            transition={{ duration: 0.15 }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
