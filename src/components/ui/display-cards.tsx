"use client";

import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  date?: string;
  iconClassName?: string;
  titleClassName?: string;
}

/** Single skewed card in a stacked decorative display. */
function DisplayCard({
  className,
  icon = <FileText className="size-4 text-blue-300" />,
  title = "Document",
  description = "Your immigration file",
  date = "Just now",
  iconClassName,
  titleClassName,
}: DisplayCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-36 w-[22rem] -skew-y-[8deg] select-none flex-col justify-between rounded-card border-2 border-border-light bg-bg-subtle/70 backdrop-blur-sm px-4 py-3 transition-all duration-700",
        "after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[20rem] after:bg-gradient-to-l after:from-bg-base after:to-transparent after:content-['']",
        "hover:border-border hover:bg-bg-subtle [&>*]:flex [&>*]:items-center [&>*]:gap-2",
        className
      )}
    >
      <div>
        <span className={cn("relative inline-block rounded-full bg-blue-800 p-1", iconClassName)}>
          {icon}
        </span>
        <p className={cn("text-lg font-medium text-pw-accent", titleClassName)}>{title}</p>
      </div>
      <p className="whitespace-nowrap text-lg text-text-secondary">{description}</p>
      <p className="text-sm text-text-tertiary">{date}</p>
    </div>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
}

/** Stacked decorative card display — used for the empty-vault illustration. */
export default function DisplayCards({ cards }: DisplayCardsProps) {
  const defaultCards: DisplayCardProps[] = [
    {
      icon: <FileText className="size-4 text-blue-300" />,
      title: "Passport",
      description: "Travel document",
      date: "Waiting to upload",
      className:
        "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-card before:outline-border-light before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-bg-base/50 grayscale hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      icon: <FileText className="size-4 text-blue-300" />,
      title: "Language Test",
      description: "IELTS / CELPIP results",
      date: "Waiting to upload",
      className:
        "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-card before:outline-border-light before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-bg-base/50 grayscale hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      icon: <FileText className="size-4 text-blue-300" />,
      title: "Your Documents",
      description: "Upload files to get started",
      date: "Up to 20 files",
      className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
    },
  ];

  const displayCards = cards ?? defaultCards;

  return (
    <div className="grid [grid-template-areas:'stack'] place-items-center animate-fade-in">
      {displayCards.map((cardProps, index) => (
        <DisplayCard key={index} {...cardProps} />
      ))}
    </div>
  );
}
