import React from "react"
import ReactDOM from "react-dom/client"
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { networkConfig } from "./networkConfig.js"


import App from "./App.js"
import { useSharedState } from "./sharedState.js"
import { SharedStateProvider } from "./sharedState.js"
import "@mysten/dapp-kit/dist/index.css"
import "./styles.css"

function Overlay() {
  const { text, desc, price, user } = useSharedState()

  return (
    <>
      <div className="dot" />
      <p className="hovertext">{text}</p>
      <p className="pricetext">
        {price} {price && "TAREA"}
      </p>
      <p className="useraddress">✅ {user}</p>
      <p className="desc" id="desc">
        💡{desc}
        {desc && (
          <>
            {" "}
            <br />
            🛒 Click on the product to buy{" "}
          </>
        )}
      </p>
      <App />
    </>
  )
}

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
          <WalletProvider autoConnect>
            <SharedStateProvider>
              <Overlay />
            </SharedStateProvider>
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
  </React.StrictMode>,
)
