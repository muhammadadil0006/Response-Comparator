interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, className = '', style }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-[#30363D] bg-[#161B22] shadow-card transition-shadow duration-200 hover:shadow-card-hover ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-b border-[#30363D] px-4 py-3 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-t border-[#30363D] px-4 py-3 ${className}`}
    >
      {children}
    </div>
  );
}
