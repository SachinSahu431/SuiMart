import { Billboard, Html, KeyboardControls, Loader, PointerLockControls, PresentationControls, Sky, Stars, Text } from "@react-three/drei"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { Physics, RigidBody } from "@react-three/rapier"
import { Suspense, useEffect, useRef, useState } from "react"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { Player } from "./Player.js"
import { useSharedState } from "./sharedState.js"
import { Model } from "./Show2.jsx"

import { Transaction } from "@mysten/sui/transactions"
import { fetchMarketplaceDynamicObject } from "./SUIFunctions.js"

import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit"
import { useNetworkVariable } from "./networkConfig.js"
// Controls: WASD + left click

const pinataGatewayToken = process.env.REACT_APP_PINATA_GATEWAY_TOKEN
const ProductModel = ({ file }) => {
  console.log(file, "file")
  const modelUrl = `${file}?pinataGatewayToken=${pinataGatewayToken}`
  const gltf = useLoader(GLTFLoader, modelUrl)
  console.log(gltf, "gltf")
  return <primitive object={gltf.scene} scale={10} />
}

function EquidistantPoints({ contract, products, buyProduct }) {
  const { setPrice, setText, setDesc } = useSharedState()
  console.log(contract, "Marketplace")
  console.log(products, "products")

  const points = []
  const numPoints = products.length

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2
    const z = Math.cos(angle) * 5
    const x = Math.sin(angle) * 5
    const y = 0.4
    const mul = 3
    points.push([x * mul, y * mul, z * mul])
  }

  function clear() {
    setPrice("")
    setText("")
    setDesc("")
  }

  return (
    <>
      {points.map((point, index) => (
        <PresentationControls key={index} snap={true} azimuth={[-Infinity, Infinity]} polar={[0, 0]}>
          <RigidBody type="fixed">
            <EquidistantMesh position={point} index={index} product={products[index]} buyProduct={buyProduct} clear={clear} />
          </RigidBody>
        </PresentationControls>
      ))}
    </>
  )
}

function EquidistantMesh({ position, index, product, buyProduct, clear }) {
  const ref = useRef()
  const { setPrice, setText, setDesc } = useSharedState()

  useFrame(() => {
    ref.current.rotation.y += 0.005
  })

  return (
    <mesh
      position={position}
      ref={ref}
      onPointerEnter={(e) => {
        setPrice(product.price)
        setText(product.name)
        setDesc(product.description)
      }}
      onPointerLeave={(e) => clear()}
      onClick={async (e) => {
        const productPrice = product.price // Assuming price is in Ether
        console.log("Buying product", index)
        setDesc("Buying...")
        buyProduct(index)
      }}>
      <Suspense fallback={<Html center>Loading model…</Html>}>
        <ProductModel file={product.ipfs_link} />
      </Suspense>
    </mesh>
  )
}

export default function App() {
  const currentAccount = useCurrentAccount()
  const queryParams = new URLSearchParams(window.location.search)
  const address = queryParams.get("market") || "loading..."
  let hours = 12 + new Date().getHours()
  // hours = 12
  let namecolor = "white"
  if (hours > 18 && hours < 32) namecolor = "green"
  const inclination = 0 // Set your desired inclination
  const azimuth = (hours / 24) * 2 * Math.PI // Calculate azimuth based on hours

  // Calculate sun position using spherical coordinates
  const y = Math.cos(azimuth) * Math.cos(inclination)
  const x = Math.sin(azimuth) * Math.cos(inclination)
  const z = Math.sin(inclination)

  const sunPosition = [x, y, z]

  const [marketContract, setMarketContract] = useState(null)
  const [marketname, setMarketName] = useState("loading...")
  const [products, setProducts] = useState([])
  const [marketdesc, setMarketDesc] = useState("loading...")

  const client = useSuiClient()
  const suiMartPackageId = useNetworkVariable("suiMartPackageId")
  const { mutate: signAndExecute, isSuccess, isPending } = useSignAndExecuteTransaction()

  const marketplaceId = address
  const buyProduct = async (selectedID) => {
    const marketplaceDynamicObject = await client.getObject({
      id: marketplaceId,
      options: { showType: true, showContent: true },
    })

    console.log("Marketplace Dynamic Object:", marketplaceDynamicObject)

    const marketplaceValue = marketplaceDynamicObject.data?.content?.fields?.value
    console.log("Buy Product")
    console.log("Marketplace ID:", marketplaceValue)

    console.log("Payment Details: (ALLLLL)", marketplaceValue, selectedID, products[selectedID].price)
    const tx = new Transaction()
    const payment = tx.splitCoins(tx.gas, [tx.pure.u64(products[selectedID].price)])
    tx.setGasBudget(10000000)

    console.log("Payment Details: ", marketplaceValue, selectedID, 1, payment)
    tx.moveCall({
      arguments: [tx.object(marketplaceValue), tx.pure.u64(selectedID), tx.pure.u64(1), payment],
      target: `${suiMartPackageId}::marketplace::buy_product`,
    })

    console.log("Transaction: ", tx)

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async ({ digest }) => {
          alert("Product Purchased Successfully!")
          const { effects } = await client.waitForTransaction({
            digest: digest,
            options: {
              showEffects: true,
            },
          })
        },
        onError: (error) => {
          alert("Product Purchase Failed!")
          console.error("Transaction Error:", error)
        },
      },
    )
  }

  const setMarketplaceFields = async (marketplaceID) => {
    const res = await fetchMarketplaceDynamicObject(client, marketplaceID)
    const fProducts = res?.data?.content?.fields?.products

    setMarketName(res?.data?.content?.fields?.name)
    setMarketDesc(res?.data?.content?.fields?.description)

    console.log("Fetched products:", res.data.content.fields.products)
    res.data.content.fields.products.forEach((p, i) => console.log(i, "fields.ipfs_link:", p.fields.ipfs_link))

    let mappedProducts = fProducts.map((p, i) => {
      return {
        name: p.fields.name,
        description: p.fields.description,
        price: p.fields.price,
        quantity: p.fields.quantity,
        ipfs_link: p.fields.ipfs_link,
      }
    })
    setProducts(mappedProducts)
  }

  useEffect(() => {
    if (marketplaceId) {
      setMarketplaceFields(marketplaceId)
    } else {
      console.error("marketplaceId is not defined")
    }

  }, [marketplaceId])

  return (
    <>
      <KeyboardControls
        map={[
          { name: "forward", keys: ["ArrowUp", "w", "W"] },
          { name: "backward", keys: ["ArrowDown", "s", "S"] },
          { name: "left", keys: ["ArrowLeft", "a", "A"] },
          { name: "right", keys: ["ArrowRight", "d", "D"] },
          { name: "jump", keys: ["Space"] },
        ]}>
        <Suspense>
          <Canvas camera={{ fov: 45 }} shadows>
            <Sky distance={450} sunPosition={sunPosition} inclination={0} azimuth={0.25} />
            <Stars depth={100} />

            <Billboard follow={true} lockX={false} lockY={false}>
              <Text font="./Inter-Bold.woff" position={[0, 5, 0]} fontSize={0.75} color={namecolor}>
                🏪 {marketname}
              </Text>
              <Text font="./Inter-Bold.woff" position={[0, 4, 0]} fontSize={0.25} color="white">
                {address}
              </Text>
              <Text font="./Inter-Regular.woff" position={[0, 3, 0]} fontSize={0.2} color="white">
                {marketdesc}
              </Text>
            </Billboard>

            <Physics>
              <Model />
              <Player />
              <Suspense fallback={<Html center>Loading models…</Html>}>
                <EquidistantPoints products={products} contract={marketContract} buyProduct={buyProduct} />
              </Suspense>

              {/* <Debug/> */}
            </Physics>

            <PointerLockControls />
            <ambientLight intensity={0.1} />
            <pointLight position={[0, 10, 0]} intensity={0.4} />
          </Canvas>
        </Suspense>
        <Loader />
      </KeyboardControls>
    </>
  )
}
