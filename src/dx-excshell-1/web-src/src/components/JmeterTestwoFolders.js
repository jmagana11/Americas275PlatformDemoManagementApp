import React, { useState, useEffect } from 'react'
import { Dialog, AlertDialog, DialogTrigger, Switch, Divider, Slider, ProgressBar, Item, Form, TextField, ActionButton, ListBox, Heading, Flex, DialogContainer, StatusLight, ContextualHelp, Content, Text, NumberField } from '@adobe/react-spectrum'
import ConfirmDialog from './ConfirmDialog'
import SandboxPicker from './SandboxPicker'

function JmeterTestwoFolders(props) {
    const [sandboxName, setSandboxName] = useState("");
    const [_isJobLoading, set_IsJobLoading] = useState(false);
    const [opeConfirmation, setOpenConfirmation] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [mirrorLink, SetMirrorLink] = useState(0);
    const [navLink, setNavLink] = useState(0);
    const [offerLink, setOfferLink] = useState(0);
    const [productLink, SetProductLink] = useState(0);
    const [socialLink, SetSocialLink] = useState(0);
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
    const [isOpen, setOpen] = useState(true);

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
        console.log('submitted')

        if (sandboxName.length === 0 ||
            logFile.length === 0 ||
            totalOpens === 0 ||
            desktopClicks === 0 ||
            numberTrackingLinks === 0) {
            setOpen(true);
            setErrorMessage('invalid')

        } else {
            setErrorMessage('valid');
            setOpen(false);
        }

        const data = {
            "jmeter": {
                "file_ref": logFile,
                "total_opens": totalOpens,
                "mobile_experience_pct": mobExpPercentage,
                "desk_clicks_pct": desktopClicks,
                "mobile_clicks_pct": mobileClicks,
                "links": {
                    "count_tracked": numberTrackingLinks,
                    "mirror": {
                        "pct": mirrorLink,
                        "pos": (mirrorPosition.split(",").map(Number).length > 0) ? mirrorPosition.split(",").map(Number) : []
                    },
                    "navigation": {
                        "pct": navLink,
                        "pos": (navLinkPosition.split(",").map(Number).length > 0) ? navLinkPosition.split(",").map(Number) : []
                    },
                    "offer": {
                        "pct": offerLink,
                        "pos": (offerPosition.split(",").map(Number).length > 0) ? offerPosition.split(",").map(Number) : []
                    },
                    "product": {
                        "pct": productLink,
                        "pos": (productPosition.split(",").map(Number).length > 0) ? productPosition.split(",").map(Number) : []
                    },
                    "social": {
                        "pct": socialLink,
                        "pos": (socialPosition.split(",").map(Number).length > 0) ? socialPosition.split(",").map(Number) : []
                    },
                    "unsub": {
                        "pct": unsubLink,
                        "pos": (unsubPosition.split(",").map(Number).length > 0) ? unsubPosition.split(",").map(Number) : [],
                        "persist": unsubscribe
                    }
                }
            },
            "options": {
                "project": "jmeter_svpoc",
                "sandbox_name": sandboxName
            }
        }
        console.log(linkError)
        console.log(errorMessage)
        if (linkError === "positive" && errorMessage === 'valid') {
            console.log(JSON.stringify(data));
            setShowConfirmation(true);
        }
    }

    function handleSandboxSelection(selection) {
        setSandboxName(selection);
        //console.log("selection", selection)
    }

    useEffect(() => {
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
    }, [mirrorLink, navLink, offerLink, productLink, socialLink, unsubLink]);
    //<SandboxPicker key={key} ims={props.ims} parentCallback={handleSandboxSelection} />
    return (
        <>
            <Heading level={3}>Run Jmeter Test without specific folder requirement</Heading>
            <Heading level={4}>Global Settings:</Heading>
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
                </Flex>
                <Flex direction="row">
                    <TextField
                        onChange={setLogFile}
                        width="size-6000"
                        label="Log File Name"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Log File</Heading>
                                <Content>
                                    <Text>
                                        Name to be used for logging purposes.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex>
                <Flex direction="row">
                    <Slider
                        isRequired={true}
                        onChange={setTotalOpens}
                        width="size-6000"
                        label="Total Opens"
                        maxValue={200}
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
                        onChange={SetMirrorLink}
                        label="Mirror Link Tracking %"
                        maxValue={100}
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
                        onChange={SetProductLink}
                        label="Product Link Tracking %"
                        maxValue={100}
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
                        onChange={SetSocialLink}
                        label="Social Link Tracking %"
                        maxValue={100}
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
            <DialogContainer onDismiss={() => setOpenConfirmation(null)}>
                {opeConfirmation && (<ConfirmDialog context={sandboxName} description={"Create Sandbox"} parentCallback={confirmation} />)}
            </DialogContainer>
            <br></br>
            {showConfirmation && (<StatusLight variant="positive">Your submission was successful. Check your Developer Tools Console in your browser to see the result</StatusLight>)}
            {errorMessage == "invalid" && (
                <DialogContainer onDismiss={() => setOpen(false)} {...props}>
                    {isOpen && (<AlertDialog
                        variant="error"
                        title="Something is wrong!"
                        primaryActionLabel="Retry"
                        cancelLabel="Cancel">
                        {sandboxName.length === 0 ? ('Please Provide a Sandbox Name') : ''}<br></br>
                        {logFile.length === 0 ? ('Please Provide a Log File Name') : ''}<br></br>
                        {totalOpens === 0 ? ('Total Opens cant be zero') : ''}<br></br>
                        {desktopClicks === 0 ? ('Desktop Clicks cant be zero') : ''}<br></br>
                        {numberTrackingLinks === 0 ? ('# of Tracking Links cant be zero') : ''}<br></br>
                    </AlertDialog>)}
                </DialogContainer>
            )}
        </>
    )
}

export default JmeterTestwoFolders;