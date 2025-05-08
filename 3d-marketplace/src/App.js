import { Canvas, useFrame } from "@react-three/fiber"
import { Loader, PointerLockControls, KeyboardControls, Text, PresentationControls, Stars } from "@react-three/drei"
import { Debug, Physics, RigidBody } from "@react-three/rapier"
import { Player } from "./Player.js"
import { Model } from "./Show2.jsx"
import { Suspense, useEffect } from "react"
import { Billboard } from "@react-three/drei"
import { Sky } from "@react-three/drei"
import { useState } from "react"
import { useSharedState } from "./sharedState.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { useLoader } from "@react-three/fiber"
import { BigNumber } from "ethers"
import { useRef } from "react"

import { fetchMarketplaceDynamicObject } from "./SUIFunctions.js"
import { Transaction } from '@mysten/sui/transactions';

import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { useNetworkVariable } from "./networkConfig.js"
// Controls: WASD + left click

const ProductModel = ({ file }) => {
  console.log(file, "file")
  const gltf = useLoader(GLTFLoader, file)
  return <primitive object={gltf.scene} scale={10} />
}

function EquidistantPoints({ contract, products }) {
  const { setPrice, setText, setDesc } = useSharedState()
  console.log(contract, "Marketplace")

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
            <EquidistantMesh position={point} index={index} product={products[index]} contract={contract} clear={clear} />
          </RigidBody>
        </PresentationControls>
      ))}
    </>
  )
}

function EquidistantMesh({ position, index, product, contract, clear }) {
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
        setPrice(BigNumber.from(product.price).toString())
        setText(product.name)
        setDesc(product.description)
      }}
      onPointerLeave={(e) => clear()}
      onClick={async (e) => {
        const productPrice = product.price // Assuming price is in Ether
        console.log("Buying product", index)
        setDesc("Buying...")
        try {
          const transaction = await contract.buyProduct(index, {
            value: productPrice + 1000000000000000, // Add some extra wei to the price to cover gas fees
          })
          await transaction.wait()
        } catch (error) {
          console.error("Transaction failed", error)
          // Handle transaction failure
        }
      }}>
      <ProductModel file={product.ipfsLink} />
    </mesh>
  )
}

export default function App() {
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

  const [account, setAccount] = useState("")
  const [marketContract, setMarketContract] = useState(null)
  const { user, setUser } = useSharedState()
  const [marketname, setMarketName] = useState("loading...")
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ipfsLink, setIpfsLink] = useState("");
  const [marketdesc, setMarketDesc] = useState("loading...")

  const client = useSuiClient();
  const suiMartPackageId = useNetworkVariable('suiMartPackageId');
  const {
    mutate: signAndExecute,
    isSuccess,
    isPending,
  } = useSignAndExecuteTransaction();

  const marketplaceId = address;
  const buyProduct = async (selectedID) => {

    const marketplaceDynamicObject = await client.getObject({
      id: marketplaceId,
      options: { showType: true, showContent: true },
    });

    console.log('Marketplace Dynamic Object:', marketplaceDynamicObject);

    const marketplaceValue = marketplaceDynamicObject.data?.content?.fields?.value;
    console.log('Buy Product');
    console.log('Marketplace ID:', marketplaceValue);
    const tx = new Transaction();

    console.log(selectedID, name, description, price, quantity, ipfsLink);
    tx.moveCall({
      arguments: [
        tx.object(marketplaceValue),
        tx.pure.u64(selectedID),
        tx.pure.string(name),
        tx.pure.string(description),
        tx.pure.u64(price),
        tx.pure.u64(quantity),
        tx.pure.string(ipfsLink),
      ],
      target: `${suiMartPackageId}::marketplace::buy_product`,
    });

    console.log('Transaction: ', tx);

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async ({ digest }) => {
          alert('Product Added Successfully!');
          const { effects } = await client.waitForTransaction({
            digest: digest,
            options: {
              showEffects: true,
            },
          });
        },
        onError: (error) => {
          alert('Product Editing Failed!');
          console.error('Transaction Error:', error);
        },
      },
    );
  };

  const setMarketplaceFields = async (marketplaceID) => {
    const res = await fetchMarketplaceDynamicObject(client, marketplaceID);
    const fProducts = res?.data?.content?.fields?.products;

    console.log("Marketplace dynamic object response:", res);
    console.log("Marketplace dynamic object fields:", res?.data?.content?.fields);

    setProducts(fProducts);
  };

  useEffect(() => {
    if (marketplaceId) {
      setMarketplaceFields(marketplaceId);
    } else {
      console.error('marketplaceId is not defined');
    }
  }, [marketplaceId]);

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
              <EquidistantPoints products={products} contract={marketContract} />
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
