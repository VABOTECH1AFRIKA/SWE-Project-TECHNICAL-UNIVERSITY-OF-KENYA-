import * as React from "react"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type AutoplayEventHook = (event: "autoplay:play", fn: () => void) => void

declare global {
  interface Window {
    __airoEditModeActive?: boolean
    __airoCarouselSlotEditActive?: boolean
    __airoCarouselSlotEditRoot?: HTMLElement | null
    __airoCarouselToolbarPauseRoot?: HTMLElement | null
  }
}

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
  carouselSlotEditActive: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins
    )
    const [canScrollPrev, setCanScrollPrev] = React.useState(false)
    const [canScrollNext, setCanScrollNext] = React.useState(false)
    const rootRef = React.useRef<HTMLDivElement | null>(null)

    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return
      }

      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }, [])

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev()
    }, [api])

    const scrollNext = React.useCallback(() => {
      api?.scrollNext()
    }, [api])

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          scrollPrev()
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          scrollNext()
        }
      },
      [scrollPrev, scrollNext]
    )

    React.useEffect(() => {
      if (!api || !setApi) {
        return
      }

      setApi(api)
    }, [api, setApi])

    React.useEffect(() => {
      if (!api) {
        return
      }

      onSelect(api)
      api.on("reInit", onSelect)
      api.on("select", onSelect)

      return () => {
        api?.off("select", onSelect)
      }
    }, [api, onSelect])

    // True when dev-tools carousel slot edit targets this carousel instance.
    const [isSlotEditTarget, setIsSlotEditTarget] = React.useState<boolean>(false)
    React.useEffect(() => {
      const syncSlotEditTarget = (): void => {
        const active = Boolean(window.__airoCarouselSlotEditActive)
        const root = window.__airoCarouselSlotEditRoot
        setIsSlotEditTarget(Boolean(active && rootRef.current && root === rootRef.current))
      }
      syncSlotEditTarget()
      window.addEventListener("airo:carousel-slot-edit", syncSlotEditTarget)
      return () => {
        window.removeEventListener("airo:carousel-slot-edit", syncSlotEditTarget)
      }
    }, [])

    React.useEffect(() => {
      const emitNavState = (): void => {
        if (!rootRef.current || !window.__airoCarouselSlotEditActive) return
        if (window.__airoCarouselSlotEditRoot !== rootRef.current) return
        window.dispatchEvent(
          new CustomEvent("airo:carousel-slot-nav-state", {
            detail: {
              canScrollPrev,
              canScrollNext,
              carouselRoot: rootRef.current,
            },
          })
        )
      }
      emitNavState()
      window.addEventListener("airo:carousel-slot-edit", emitNavState)
      return () => {
        window.removeEventListener("airo:carousel-slot-edit", emitNavState)
      }
    }, [canScrollPrev, canScrollNext, isSlotEditTarget])

    React.useEffect(() => {
      const handleNav = (event: Event): void => {
        const detail = (event as CustomEvent<{ direction?: string }>).detail
        if (!rootRef.current || window.__airoCarouselSlotEditRoot !== rootRef.current) return
        if (detail?.direction === "prev" && canScrollPrev) scrollPrev()
        else if (detail?.direction === "next" && canScrollNext) scrollNext()
      }
      window.addEventListener("airo:carousel-slot-nav", handleNav)
      return () => {
        window.removeEventListener("airo:carousel-slot-nav", handleNav)
      }
    }, [scrollPrev, scrollNext, canScrollPrev, canScrollNext])

    React.useEffect(() => {
      if (!api || !isSlotEditTarget) return

      const emitSelectedSlide = (): void => {
        if (!rootRef.current) return
        if (window.__airoCarouselSlotEditRoot !== rootRef.current) return
        window.dispatchEvent(
          new CustomEvent("airo:carousel-slot-select", {
            detail: {
              carouselRoot: rootRef.current,
              selectedIndex: api.selectedScrollSnap(),
            },
          })
        )
      }

      api.on("select", emitSelectedSlide)
      return () => {
        api.off("select", emitSelectedSlide)
      }
    }, [api, isSlotEditTarget])

    React.useEffect(() => {
      if (!api) return
      type PausablePlugin = { stop: () => void; play: () => void }
      const getAutoplay = (): PausablePlugin | undefined => {
        const plugin: unknown = (api.plugins() as Record<string, unknown>).autoplay
        if (
          plugin &&
          typeof (plugin as PausablePlugin).stop === "function" &&
          typeof (plugin as PausablePlugin).play === "function"
        ) {
          return plugin as PausablePlugin
        }
        return undefined
      }
      const shouldPauseAutoplay = (): boolean => {
        const root = rootRef.current
        if (!root) return false
        if (window.__airoCarouselSlotEditActive) {
          const slotEditRoot = window.__airoCarouselSlotEditRoot
          if (slotEditRoot == null || slotEditRoot === root) return true
        }
        return window.__airoCarouselToolbarPauseRoot === root
      }
      const apply = (paused: boolean): void => {
        const autoplay: PausablePlugin | undefined = getAutoplay()
        if (!autoplay) return
        if (paused) autoplay.stop()
        else autoplay.play()
      }
      const syncAutoplay = (): void => {
        apply(shouldPauseAutoplay())
      }
      syncAutoplay()
      const handleAutoplayPauseChange = (): void => {
        syncAutoplay()
      }
      const onAutoplayPlay = (): void => {
        if (!shouldPauseAutoplay()) return
        queueMicrotask(() => {
          if (shouldPauseAutoplay()) getAutoplay()?.stop()
        })
      }
      window.addEventListener("airo:carousel-slot-edit", handleAutoplayPauseChange)
      window.addEventListener("airo:carousel-toolbar-pause", handleAutoplayPauseChange)
      const onAutoplay: AutoplayEventHook = api.on as unknown as AutoplayEventHook
      const offAutoplay: AutoplayEventHook = api.off as unknown as AutoplayEventHook
      onAutoplay("autoplay:play", onAutoplayPlay)
      return () => {
        window.removeEventListener("airo:carousel-slot-edit", handleAutoplayPauseChange)
        window.removeEventListener("airo:carousel-toolbar-pause", handleAutoplayPauseChange)
        offAutoplay("autoplay:play", onAutoplayPlay)
      }
    }, [api])

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation:
            orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
          carouselSlotEditActive: isSlotEditTarget,
        }}
      >
        <div
          ref={mergedRef}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    )
  }
)
Carousel.displayName = "Carousel"

const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
})
CarouselContent.displayName = "CarouselContent"

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel()

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
})
CarouselItem.displayName = "CarouselItem"

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev, carouselSlotEditActive } = useCarousel()

  if (carouselSlotEditActive) {
    return null
  }

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute  h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-left-12 top-1/2 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
})
CarouselPrevious.displayName = "CarouselPrevious"

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollNext, canScrollNext, carouselSlotEditActive } = useCarousel()

  if (carouselSlotEditActive) {
    return null
  }

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-right-12 top-1/2 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight className="h-4 w-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  )
})
CarouselNext.displayName = "CarouselNext"

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
}
