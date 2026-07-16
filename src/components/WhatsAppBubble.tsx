import { motion } from "framer-motion";

const WHATSAPP_URL = "https://wa.me/15550000000?text=" +
  encodeURIComponent("Olá, venho do site da GoDrive e gostaria de realizar uma reserva!");

const WhatsAppBubble = () => (
  <motion.a
    href={WHATSAPP_URL}
    target="_blank"
    rel="noopener noreferrer"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: 2, type: "spring", stiffness: 260, damping: 20 }}
    className="hide-in-standalone app-chrome fixed z-50 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#25D366] shadow-lg shadow-[#25D366]/30 hover:scale-110 transition-transform duration-200"
    style={{
      right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
    }}

    aria-label="WhatsApp"
  >
    <svg viewBox="0 0 32 32" className="w-6 h-6 sm:w-7 sm:h-7" fill="white">
      <path d="M16.004 2.003C8.27 2.003 2.004 8.27 2.004 16c0 2.474.646 4.89 1.873 7.016L2 30l7.168-1.88A13.93 13.93 0 0016.004 30C23.73 30 30 23.73 30 16S23.73 2.003 16.004 2.003zm0 25.477a11.45 11.45 0 01-5.834-1.594l-.418-.248-4.337 1.137 1.158-4.23-.273-.434a11.42 11.42 0 01-1.753-6.108c0-6.335 5.155-11.49 11.49-11.49 6.335 0 11.49 5.155 11.49 11.49s-5.187 11.477-11.523 11.477zm6.303-8.6c-.346-.174-2.046-1.01-2.363-1.125-.317-.115-.548-.174-.779.173-.23.346-.893 1.125-1.095 1.356-.2.23-.403.26-.749.087-.346-.173-1.46-.538-2.782-1.715-1.028-.916-1.723-2.048-1.924-2.394-.2-.346-.021-.534.15-.707.155-.155.346-.404.52-.606.173-.202.23-.346.346-.577.115-.23.058-.432-.029-.606-.087-.173-.779-1.877-1.067-2.57-.28-.674-.566-.582-.779-.593l-.663-.012c-.23 0-.606.087-.923.432-.317.346-1.21 1.183-1.21 2.886s1.24 3.348 1.413 3.578c.173.23 2.44 3.726 5.914 5.224.826.357 1.47.57 1.973.73.83.263 1.584.226 2.182.137.666-.1 2.046-.836 2.335-1.643.288-.808.288-1.5.2-1.643-.086-.144-.317-.23-.663-.404z" />
    </svg>
  </motion.a>
);

export default WhatsAppBubble;
