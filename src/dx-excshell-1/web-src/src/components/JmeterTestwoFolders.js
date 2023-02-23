import React, { useState, useEffect } from 'react'
import { Dialog, AlertDialog, DialogTrigger, Switch, Divider, Slider, ProgressBar, Item, Form, TextField, ActionButton, ListBox, Heading, Flex, DialogContainer, StatusLight, ContextualHelp, Content, Text, NumberField } from '@adobe/react-spectrum'
import ConfirmDialogJmeter from './ConfirmDialogJmeter'
import SandboxPicker from './SandboxPicker'
import allActions from '../config.json'

function JmeterTestwoFolders(props) {
    const [sandboxName, setSandboxName] = useState("");
    const [_isJobLoading, set_IsJobLoading] = useState(false);
    const [opeConfirmation, setOpenConfirmation] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [mirrorLink, setMirrorLink] = useState(0);
    const [navLink, setNavLink] = useState(0);
    const [offerLink, setOfferLink] = useState(0);
    const [productLink, setProductLink] = useState(0);
    const [socialLink, setSocialLink] = useState(0);
    const [unsubLink, setUnsubLink] = useState(0);
    const [linkError, setLinkError] = useState("yellow");
    const [logFile, setLogFile] = useState("");
    const [totalOpens, setTotalOpens] = useState(0);
    const [mobExpPercentage, setMobExpPercentage] = useState(0);
    const [desktopClicks, setDesktopClicks] = useState(0);
    const [mobileClicks, setMobileClicks] = useState(0);
    const [numberTrackingLinks, setNumberTrackingLinks] = useState(0);
    const [mirrorPosition, setMirrorPosition] = useState("");
    const [navLinkPosition, setNavLinkPosition] = useState("");
    const [offerPosition, setOfferPosition] = useState("");
    const [productPosition, setProductPosition] = useState("");
    const [socialPosition, setSocialPosition] = useState("");
    const [unsubPosition, setUnsubPosition] = useState("");
    const [unsubscribe, setUnsubscribe] = useState(false);
    const [result, setResult] = useState('');
    const [globalSetErrors, setGlobalSetErrors] = useState("yellow");

    useEffect(() => {
        //validations:
        const total = mirrorLink + navLink + offerLink + productLink + socialLink + unsubLink;

        if (total > 100) {
            setLinkError("negative");
        }
        if (total < 100) {
            setLinkError("yellow")
        }
        if (total === 100) {
            setLinkError("positive")
        }

        if( sandboxName.length > 0 && 
            totalOpens > 0 && 
            mobExpPercentage > 0  && 
            desktopClicks > 0 && 
            mobileClicks > 0  && 
            numberTrackingLinks > 0){
                
                setGlobalSetErrors("positive");
                console.log("positive")
        }
    }, [mirrorLink, navLink, offerLink, productLink, socialLink, unsubLink, sandboxName, logFile, totalOpens, mobExpPercentage, desktopClicks, mobileClicks, numberTrackingLinks]);

    function resetState(){
        //we reset the state after a successful submission...
        setMirrorLink(0);
        setNavLink(0);
        setOfferLink(0);
        setProductLink(0);
        setSocialLink(0);
        setUnsubLink(0);
        setLogFile("");
        setTotalOpens(0);
        setMobExpPercentage(0);
        setDesktopClicks(0);
        setMobileClicks(0);
        setNumberTrackingLinks(0);
        setMirrorPosition("");
        setOfferPosition("");
        setNavLinkPosition("");
        setOfferPosition("");
        setProductPosition("");
        setSocialPosition("");
        setUnsubPosition("");
        setUnsubscribe(false);
    }

    function cleanSandboxName() {
        if (sandboxName.indexOf('-') !== -1) {
            const splitName = sandboxName.split('-');
            const newName = splitName[0];
            console.log(newName);
            return newName;
        } else {
            return sandboxName;
        }
    }

    //Start setting the header object
    const actionHeaders = {
        'Content-Type': 'application/json'
    }

    const fetchConfig = {
        headers: actionHeaders
    }

    if (window.location.hostname === 'localhost') {
        actionHeaders['x-ow-extra-logging'] = 'on'
    }

    // set the authorization header and org from the ims props object
    if (props.ims.token && !actionHeaders.authorization) {
        actionHeaders.authorization = `Bearer ${props.ims.token}`
    }
    if (props.ims.org && !actionHeaders['x-gw-ims-org-id']) {
        actionHeaders['x-gw-ims-org-id'] = props.ims.org
    }

    function confirmation(data) {
        if (data) {
            console.log('sandbox to be Created:', sandboxName)
            setShowConfirmation(data);
        }

    }

    function handleFormSubmission(event) {
        event.preventDefault();

        const data = { "formBody": {
                "jmeter": {
                    "file_ref": `ma1_svpoc_${cleanSandboxName()}_testv9_beta0`,
                    "total_opens": totalOpens,
                    "mobile_experience_pct": mobExpPercentage,
                    "desk_clicks_pct": desktopClicks,
                    "mobile_clicks_pct": mobileClicks,
                    "links": {
                        "count_tracked": numberTrackingLinks,
                        "mirror": {
                            "pct": mirrorLink,
                            "pos": (mirrorPosition.trim() !== "") ? mirrorPosition.split(",").map(Number) : []
                        },
                        "navigation": {
                            "pct": navLink,
                            "pos": (navLinkPosition.trim() !== "") ? navLinkPosition.split(",").map(Number) : []
                        },
                        "offer": {
                            "pct": offerLink,
                            "pos": (offerPosition.trim() !== "") ? offerPosition.split(",").map(Number) : []
                        },
                        "product": {
                            "pct": productLink,
                            "pos": (productPosition.trim() !== "") ? productPosition.split(",").map(Number) : []
                        },
                        "social": {
                            "pct": socialLink,
                            "pos": (socialPosition.trim() !== "") ? socialPosition.split(",").map(Number) : []
                        },
                        "unsub": {
                            "pct": unsubLink,
                            "pos": (unsubPosition.trim() !== "") ? unsubPosition.split(",").map(Number) : [],
                            "persist": unsubscribe
                        }
                    }
                },
                "options": {
                    "project": "jmeter_svpoc",
                    "sandbox_name": sandboxName
                }
            }
        }

        //We check there is no errors on the fields. 
        if (linkError === "positive" && globalSetErrors === 'positive') {
            console.log(JSON.stringify(data));
            set_IsJobLoading(true);
            callAction(JSON.stringify(data));
        }
    }

    //This handles our custom sandbox picker
    function handleSandboxSelection(selection) {
        setSandboxName(selection);
    }

    function callAction(data){
        fetchConfig['body'] = data;
        fetchConfig['method'] = 'POST';
    try{
        fetch(allActions.jmeterNFemailTracking, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                if (data.pid) { 
                    setResult(JSON.stringify(data));
                    set_IsJobLoading(false); 
                    setShowConfirmation(true); 
                    resetState(); 
                    setGlobalSetErrors('yellow');
                    console.log('Form submitted successfully:', data);
                } else{
                    setResult(JSON.stringify(data));
                    set_IsJobLoading(false); 
                    setShowConfirmation(true); 
                }
                
            });
        } catch(e){
            setResult(JSON.stringify(data));
            set_IsJobLoading(false); 
            setShowConfirmation(true); 
        }
    }

    return (
        <>
            <Heading level={3}>Run Jmeter Test without specific folder requirement</Heading>
            <Heading level={4}>Global Settings:</Heading>
            <StatusLight variant={globalSetErrors}>You must provide all fields in this section.</StatusLight><br></br>
            <Form isRequired={true} onSubmit={handleFormSubmission}>
                <Flex direction="row">
                    <SandboxPicker
                        contextualHelp={
                            {
                                "heading": "Sandbox Name",
                                "body": "This will determine which inbox should we look for the emails."
                            }}
                        ims={props.ims}
                        parentCallback={handleSandboxSelection} />
                </Flex><br></br>
                <Flex direction="row">
                    <Slider
                        isRequired={true}
                        onChange={setTotalOpens}
                        width="size-6000"
                        label="Total Opens"
                        maxValue={200}
                        value={totalOpens}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Total Opens</Heading>
                                <Content>
                                    <Text>
                                        Maximum 200.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex>
                <Flex direction="row">
                    <Slider
                        onChange={setMobExpPercentage}
                        width="size-6000"
                        label="Mobile Experience %"
                        maxValue={100}
                        value={mobExpPercentage}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Mobile Experience %</Heading>
                                <Content>
                                    <Text>
                                        From the total opens how many will be mobile.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex>
                <Flex direction="row">
                    <Slider
                        onChange={setDesktopClicks}
                        width="size-6000"
                        label="Desktop Clicks %"
                        maxValue={100}
                        value={desktopClicks}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Desktop Clicks %</Heading>
                                <Content>
                                    <Text>
                                        How many clicks you want for desktop opens
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex >
                <Flex direction="row">
                    <Slider
                        onChange={setMobileClicks}
                        width="size-6000"
                        label="Mobile Clicks %"
                        value={mobileClicks}
                        maxValue={100}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Desktop Experience %</Heading>
                                <Content>
                                    <Text>
                                        This refers to the desktop version reporting.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex >
                <Flex direction="row">
                    <Slider
                        onChange={setNumberTrackingLinks}
                        width="size-6000"
                        label="# of Tracking Links"
                        maxValue={20}
                        value={numberTrackingLinks}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Desktop Experience %</Heading>
                                <Content>
                                    <Text>
                                        This refers to the desktop version reporting.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex >
                <br></br>
                <Divider />
                <br></br>
                <Heading level={4}>
                    Link Tracking Configuration:
                </Heading>
                <StatusLight variant={linkError}>All Link Tracking Percentages must provide a total of 100%</StatusLight><br></br>
                <Heading align="center" level={1} color="red">Total: {mirrorLink + navLink + offerLink + productLink + socialLink + unsubLink} %</Heading>
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setMirrorLink}
                        label="Mirror Link Tracking %"
                        maxValue={100}
                        value={mirrorLink}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Mirror Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the mirror links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setMirrorPosition}
                        value={mirrorPosition}
                        label="Mirror Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Mirror Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the mirror links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex>
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setNavLink}
                        label="Nav Link Tracking %"
                        maxValue={100}
                        value={navLink}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Nav Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Navigation links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setNavLinkPosition}
                        value={navLinkPosition}
                        label="Nav Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Nav Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the Navigation links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex>
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setOfferLink}
                        label="Offer Link Tracking %"
                        value={offerLink}
                        maxValue={100}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Offer Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Offer links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setOfferPosition}
                        value={offerPosition}
                        label="Offer Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Offer Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the Offer links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex >
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setProductLink}
                        label="Product Link Tracking %"
                        maxValue={100}
                        value={productLink}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Product Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Product links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setProductPosition}
                        label="Product Link Positions"
                        value={productPosition}
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Product Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the Product links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex >
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setSocialLink}
                        label="Social Link Tracking %"
                        maxValue={100}
                        value={socialLink}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Social Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Social links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setSocialPosition}
                        value={socialPosition}
                        label="Social Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Social Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the social links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex >
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setUnsubLink}
                        value={unsubLink}
                        label="Unsub Link Tracking %"
                        maxValue={100}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Unsub Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Unsubscribed/Opt-out links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setUnsubPosition}
                        value={unsubPosition}
                        label="Unsubscribed Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Unsubscribed Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the Unsubscribed links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex >
                <Switch
                    onChange={setUnsubscribe}
                    value={unsubscribe}
                    contextualHelp={
                        <ContextualHelp variant="info" placement="top start" flex>
                            <Heading>Unsubscribed Link Positions</Heading>
                            <Content>
                                <Text>
                                    This field requires to enter a comma separated list of numbers.
                                    Each number represents the position of the Unsubscribed links within your email.
                                    Check the email editor link tracking to get the position.
                                    Example: 1,2,3,4,5
                                </Text>
                            </Content>
                        </ContextualHelp>
                    }>Would you like to totally unsubscribe users in the platform?</Switch>
                <Flex>
                    <ActionButton disabled={false} type="submit">Generate Email Reporting</ActionButton>
                </Flex>
                {_isJobLoading && (
                    <ProgressBar aria-label="Loading.." isIndeterminate={true} />
                )}
            </Form>
            <DialogContainer onDismiss={() => setShowConfirmation(null)}>
                {showConfirmation && (<ConfirmDialogJmeter context={sandboxName} message={result} parentCallback={confirmation} />)}
            </DialogContainer>
            <br></br>
            {showConfirmation && (<StatusLight variant="positive">Your submission was successful. Check your Developer Tools Console in your browser to see the result</StatusLight>)}
        </>
    )
}

export default JmeterTestwoFolders;