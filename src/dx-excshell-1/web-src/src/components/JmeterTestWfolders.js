import { useState, useEffect } from 'react';
import Settings from '@spectrum-icons/workflow/Settings';
import {
    TextField,
    Slider,
    ActionButton,
    DialogTrigger,
    Dialog,
    Form,
    Heading,
    Content,
    Divider,
    Flex,
    StatusLight,
    ContextualHelp,
    Switch

} from '@adobe/react-spectrum';

function JmeterTestWfolders(props) {
    const [rows, setRows] = useState([{ textValue: '', sliders: [0, 0, 0] }]);
    const [mirrorLink, setMirrorLink] = useState(0);
    const [navLink, setNavLink] = useState(0);
    const [offerLink, setOfferLink] = useState(0);
    const [productLink, setProductLink] = useState(0);
    const [socialLink, setSocialLink] = useState(0);
    const [unsubLink, setUnsubLink] = useState(0);
    const [mirrorPosition, setMirrorPosition] = useState("");
    const [navLinkPosition, setNavLinkPosition] = useState("");
    const [offerPosition, setOfferPosition] = useState("");
    const [productPosition, setProductPosition] = useState("");
    const [socialPosition, setSocialPosition] = useState("");
    const [unsubPosition, setUnsubPosition] = useState("");
    const [unsubscribe, setUnsubscribe] = useState(false);
    const [result, setResult] = useState('');
    const [linkError, setLinkError] = useState("yellow");
    const [folderError, setFolderError] = useState("yellow");
    const [total, setTotal] = useState(0);

    useEffect(() => {
        //validations:
        const _total = mirrorLink + navLink + offerLink + productLink + socialLink + unsubLink;
        if (_total > 100) {
            setLinkError("negative");
        }
        if (_total < 100) {
            setLinkError("yellow")
        }
        if (_total === 100) {
            setLinkError("positive")
        }
        if (total === 100) {
            setFolderError("positive")
        }
        if (total > 100) {
            setFolderError("negative")
        }

        if (total < 100) {
            setFolderError('yellow')
        }
    }, [mirrorLink, navLink, offerLink, productLink, socialLink, unsubLink, total]);

    const updateTotal = () => {
        const sumOfFirstSliders = rows.reduce((acc, row) => acc + row.sliders[0], 0);
        setTotal(sumOfFirstSliders);
    };

    const handleAddRow = () => {
        if (rows.length < 4) {
            setRows([...rows, { textValue: '', sliders: [0, 0, 0] }]);
        } else {
            console.log('Maximum number of rows reached');
        }
    };

    const handleTextValueChange = (index, value) => {
        setRows(rows.map((row, i) => (i === index ? { ...row, textValue: value } : row)));
    };

    const handleSliderChange = (index, sliderIndex, value) => {
        setRows(rows.map((row, i) => {
            if (i === index) {
                const sliders = [...row.sliders];
                sliders[sliderIndex] = value;
                return { ...row, sliders };
            }
            return row;
        }));
        console.log(rows);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const sumOfFirstSliders = rows.reduce((acc, row) => acc + row.sliders[0], 0);
        if (sumOfFirstSliders > 100) {
            console.log('Sum of first sliders exceeds 100');
        } else {
            console.log(rows);
        }
    };

    return (
        <>
            <Heading level={4}>
                Run Jmeter Test with specific folder requirements
            </Heading>
            <StatusLight variant={folderError}>All Folder Tracking Percentages must provide a total of 100%</StatusLight><br></br>
            <Heading align="center" level={1} color="red">Total: {total} %</Heading>
            <Form onSubmit={handleSubmit}>
                {rows.map((row, i) => (
                    <div key={i} >
                        <Flex direction="row" gap="size-500">
                            <TextField
                                label={`Folder #${i + 1}`}
                                value={row.textValue}
                                onChange={(value) => handleTextValueChange(i, value)}
                                width={500}
                            />
                            <DialogTrigger type="popover" placement="right top" >
                                <ActionButton top='24px' aria-label="Icon only"> <Settings /></ActionButton>
                                <Dialog>
                                    <Heading>Folder #{i + 1} Configuration:</Heading>
                                    <Divider />
                                    <Content>
                                        <Slider
                                            label="Folder Tracking %:"
                                            value={row.sliders[0]}
                                            onChange={(value) => { handleSliderChange(i, 0, value); updateTotal() }}
                                            max={100}
                                        />
                                        <Slider
                                            label="Desktop Clicks %:"
                                            value={row.sliders[1]}
                                            onChange={(value) => { handleSliderChange(i, 1, value); updateTotal() }}
                                            max={100}
                                        />
                                        <Slider
                                            label="Mobile Clicks %:"
                                            value={row.sliders[2]}
                                            onChange={(value) => { handleSliderChange(i, 2, value); updateTotal() }}
                                            max={100}
                                        />
                                    </Content>
                                </Dialog>
                            </DialogTrigger>
                        </Flex>
                    </div>
                ))}
                <ActionButton variant="primary" onPress={handleAddRow} marginTop="size-100">
                    Add Row
                </ActionButton>
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
                    }>Would you like to totally unsubscribe users in the platform?
                </Switch>
                <ActionButton variant="primary" type="submit" marginTop="size-200">
                    Submit
                </ActionButton>
            </Form>
        </>
    );
}

export default JmeterTestWfolders
